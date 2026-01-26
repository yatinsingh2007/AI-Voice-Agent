"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "./DashboardLayout";
import VoiceOrb from "@/components/VoiceOrb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Activity, Clock, Cpu, Globe, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState("idle");
    const [statusDetail, setStatusDetail] = useState("");
    const [searchResults, setSearchResults] = useState("");
    const [stats, setStats] = useState({ latency: "0ms", turnTime: "0.0s" });
    const [volume, setVolume] = useState(0);
    const [isGreetingFinished, setIsGreetingFinished] = useState(false);

    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const micStreamRef = useRef(null);
    const mediaSourceRef = useRef(null);
    const sourceBufferRef = useRef(null);
    const audioQueueRef = useRef([]);
    const audioRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const noiseThreshold = 0.02;

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        audioQueueRef.current = [];

        // Clear MSE buffer to prevent old audio from playing later
        if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
            try {
                if (sourceBufferRef.current.buffered.length > 0) {
                    sourceBufferRef.current.remove(0, audioRef.current.duration || 1000000);
                }
            } catch (e) {
                console.debug("SourceBuffer clear error:", e);
            }
        }
    };

    // Initialize Audio and MediaSource once on mount
    useEffect(() => {
        // 1. Create AudioContext and Analyser
        const context = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = context;

        // Attempt to resume immediately
        context.resume().catch(() => console.debug("Autoplay restricted"));

        const analyser = context.createAnalyser();
        analyser.fftSize = 256;

        analyserRef.current = analyser;

        // 2. Setup MediaSource and Audio Element
        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;

        const audio = new Audio();
        audio.src = URL.createObjectURL(mediaSource);
        audioRef.current = audio;

        // 3. Permanent Connection: Connect HTMLMediaElement to context
        sourceNodeRef.current = context.createMediaElementSource(audio);
        sourceNodeRef.current.connect(analyser); // For visualization
        sourceNodeRef.current.connect(context.destination); // For AI audio output

        // 4. Handle MediaSource Opening
        const handleSourceOpen = () => {
            try {
                const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
                sourceBufferRef.current = sourceBuffer;

                // Process any chunks that arrived before MSE was ready
                if (audioQueueRef.current.length > 0) {
                    sourceBuffer.appendBuffer(audioQueueRef.current.shift());
                }

                sourceBuffer.addEventListener('updateend', () => {
                    if (audioQueueRef.current.length > 0 && !sourceBuffer.updating) {
                        const nextChunk = audioQueueRef.current.shift();
                        if (nextChunk) sourceBuffer.appendBuffer(nextChunk);
                    }
                });
            } catch (e) {
                console.error("MSE Error:", e);
            }
        };

        mediaSource.addEventListener('sourceopen', handleSourceOpen);
        audio.play().catch(e => console.debug("Interaction required for audio"));

        updateVolume();

        return () => {
            mediaSource.removeEventListener('sourceopen', handleSourceOpen);
            if (context.state !== 'closed') context.close();
        };
    }, []);

    // We removed the auto-start on mount to prevent browser-muted greetings 
    // causing a perceived delay. The user now 'Wakes' Nebula by clicking the mic.

    const playOutputAudio = async (arrayBuffer) => {
        // Always push to queue first to ensure order and avoid loss
        audioQueueRef.current.push(arrayBuffer);

        // If buffer is ready and not updating, trigger the next chunk
        if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
            try {
                const nextChunk = audioQueueRef.current.shift();
                if (nextChunk) sourceBufferRef.current.appendBuffer(nextChunk);
            } catch (e) {
                console.debug("Buffer append error:", e);
            }
        }

        // Ensure audio element is playing (might be paused after interruption)
        if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(e => console.debug("Play blocked or failed:", e));
        }

        // Ensure context is resumed on user interaction
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };

    const activateMic = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;

            const source = audioContextRef.current.createMediaStreamSource(stream);
            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

            // Connect mic to the SAME persistent analyser for visualization
            // But NOT to the destination, to avoid echo
            source.connect(analyserRef.current);
            source.connect(processor);
            // processor.connect(audioContextRef.current.destination); // REMOVED to stop echo

            processor.onaudioprocess = (e) => {
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                    socketRef.current.send(pcmData.buffer);
                }
            };
        } catch (err) {
            console.error("Mic activation error:", err);
        }
    };

    const stopRecording = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        // We do NOT close the AudioContext here to keep persistent nodes alive
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }
        if (socketRef.current) {
            socketRef.current.close();
        }
        setIsActive(false);
        setStatus("idle");
        setIsGreetingFinished(false);
    };

    useEffect(() => {
        if (isGreetingFinished && isActive && !micStreamRef.current) {
            activateMic();
        }
    }, [isGreetingFinished, isActive]);

    const updateVolume = () => {
        if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            setVolume(average / 128)
        }
        animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    const startRecording = async () => {
        try {
            const socket = new WebSocket("ws://localhost:8000/api/v1/voice/stream");
            socketRef.current = socket;

            socket.onopen = () => {
                console.log("Nebula Connected");
                setIsActive(true);
            };

            socket.onmessage = async (event) => {
                if (event.data instanceof Blob) {
                    const arrayBuffer = await event.data.arrayBuffer();
                    playOutputAudio(arrayBuffer);
                    return;
                }

                const data = JSON.parse(event.data);
                if (data.type === "status") {
                    if (data.status) {
                        setStatus(data.status);
                        if (data.status === "interrupted") {
                            stopAudio();
                            setStatus("listening");
                        }
                        // Restore isGreetingFinished to trigger mic activation
                        if (data.status === "listening" && !isGreetingFinished) {
                            setIsGreetingFinished(true);
                        }
                    }
                    if (data.detail) setStatusDetail(data.detail);
                }

                if (data.type === "search") {
                    setSearchResults(data.results);
                }

                if (data.type === "error") {
                    console.error("Agent Error:", data.message);
                }
            };

            socket.onclose = () => stopRecording();
        } catch (err) {
            console.error("Connection Error:", err);
            setStatus("idle");
        }
    };

    const toggleSession = () => {
        // Critical: Resume AudioContext on user interaction to satisfy autoplay policies
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }

        if (isActive) stopRecording();
        else {
            setSearchResults("");
            setStatusDetail("");
            startRecording();
        }
    };

    return (
        <DashboardLayout>
            <div className="relative flex min-h-full py-8 md:h-[calc(100vh-64px)] p-4 md:p-6 overflow-hidden">
                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] md:w-[600px] md:h-[600px] bg-primary/5 rounded-full blur-[60px] md:blur-[120px]" />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="z-10 mb-8"
                    >
                        <Badge variant="outline" className="px-3 py-1 md:px-4 md:py-1.5 bg-muted/50 border-primary/20 backdrop-blur-md text-primary tracking-widest uppercase text-[8px] md:text-[10px] font-bold">
                            {status === "idle" ? "Connection Ready" :
                                status === "listening" ? "Listening to You" :
                                    status === "thinking" ? "Nebula is Thinking" :
                                        status === "searching" ? `Searching: ${statusDetail}` : "Nebula is Speaking"}
                        </Badge>
                    </motion.div>

                    <div className="flex flex-col items-center gap-6 md:gap-12 w-full max-w-lg z-10">
                        <VoiceOrb status={status} volume={volume} />

                        <div className="flex flex-col items-center gap-2 md:gap-4 text-center px-4">
                            <motion.h1
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-2xl md:text-4xl font-bold tracking-tight text-foreground"
                            >
                                {status === "idle" ? "Nebula AI" :
                                    status === "searching" ? "Browsing Web..." : "How can I help you?"}
                            </motion.h1>
                            <p className="text-xs md:text-sm text-muted-foreground max-w-sm uppercase tracking-[0.2em] font-mono">
                                {isActive ? "Voice interface active" : "Session disconnected"}
                            </p>
                        </div>

                        <Button
                            size="lg"
                            className={cn(
                                "h-16 w-16 md:h-20 md:w-20 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110",
                                isActive ? "bg-red-500/20 text-red-500 border-red-500/50 hover:bg-red-500/30" : "bg-primary text-primary-foreground"
                            )}
                            onClick={toggleSession}
                        >
                            {isActive ? <Square className="h-6 w-6 md:h-8 md:w-8 fill-current" /> : <Mic className="h-8 w-8 md:h-10 md:w-10" />}
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 w-full max-w-4xl mx-auto mt-12 z-10 px-4">
                        <MetricCard icon={Activity} label="Latency" value={stats.latency} color="text-green-500" />
                        <MetricCard icon={Zap} label="Response" value={stats.turnTime} color="text-yellow-500" />
                        <MetricCard icon={Cpu} label="System" value="Active" color="text-blue-500" />
                        <MetricCard icon={Globe} label="Access" value="Neural" color="text-cyan-500" />
                    </div>
                </div>

                {/* Right Panel for Search Results */}
                <AnimatePresence>
                    {searchResults && (
                        <motion.div
                            initial={{ x: 300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 300, opacity: 0 }}
                            className="hidden xl:flex flex-col w-80 border-l border-border bg-card/30 backdrop-blur-md p-6 overflow-y-auto"
                        >
                            <div className="flex items-center gap-2 mb-6">
                                <Globe className="h-5 w-5 text-primary" />
                                <h2 className="text-lg font-bold">Search Insights</h2>
                            </div>
                            <div className="space-y-4">
                                {searchResults.split('\n\n').map((result, i) => (
                                    <Card key={i} className="p-4 bg-background/50 border-border/50 text-xs">
                                        <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                                            {result}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}


function MetricCard({ icon: Icon, label, value, color }) {
    return (
        <Card className="glass border-border/50 bg-background/20 backdrop-blur-sm p-3 md:p-4 flex items-center gap-3 md:gap-4">
            <div className={cn("p-1.5 md:p-2 rounded-lg bg-muted/20", color)}>
                <Icon className="h-3 w-3 md:h-4 md:w-4" />
            </div>
            <div className="flex flex-col">
                <span className="text-[8px] md:text-[10px] text-muted-foreground uppercase font-mono">{label}</span>
                <span className="text-xs md:text-sm font-bold text-foreground">{value}</span>
            </div>
        </Card>
    );
}

function Badge({ children, className, variant }) {
    return (
        <span className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            variant === "outline" ? "text-foreground" : "bg-primary text-primary-foreground hover:bg-primary/80",
            className
        )}>
            {children}
        </span>
    );
}
