"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "./DashboardLayout";
import VoiceOrb from "@/components/VoiceOrb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Activity, Clock, Cpu, Globe, Zap, Download, Sparkles, MessageSquare, ShieldCheck } from "lucide-react";
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
    const [displayedStatus, setDisplayedStatus] = useState("idle");

    // History State
    const [history, setHistory] = useState([]);
    const historyEndRef = useRef(null);

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

    // Auto-scroll history
    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    const addToHistory = (role, text) => {
        setHistory(prev => [...prev, { role, text, timestamp: new Date() }]);
    };

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

    const isAiSpeakingRef = useRef(false);

    useEffect(() => {
        // Sync ref with status for use in event listeners
        isAiSpeakingRef.current = (status === "speaking" || displayedStatus === "speaking");
    }, [status, displayedStatus]);

    const activateMic = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000
                }
            });
            micStreamRef.current = stream;

            // Ensure worklet is loaded
            try {
                await audioContextRef.current.audioWorklet.addModule('/audio-processor.js');
            } catch (e) {
                console.debug("Worklet already loaded or failed:", e);
            }

            const source = audioContextRef.current.createMediaStreamSource(stream);
            const workletNode = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');

            source.connect(analyserRef.current);
            source.connect(workletNode);
            // We connect to destination only if we want to hear our own voice (usually not)
            // workletNode.connect(audioContextRef.current.destination);

            workletNode.port.onmessage = (event) => {
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                    const inputData = event.data;
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
            addToHistory("error", "Could not access microphone. Please check permissions.");
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
        if (status === "speaking") {
            setDisplayedStatus("speaking");
        } else if (status === "listening") {
            // Buffer sync: Delay visual switch to listening 
            // to allow browser audio buffer to drain
            const timer = setTimeout(() => {
                setDisplayedStatus("listening");
                if (!isGreetingFinished) setIsGreetingFinished(true);
            }, 800);
            return () => clearTimeout(timer);
        } else {
            setDisplayedStatus(status);
        }
    }, [status, isGreetingFinished]);

    useEffect(() => {
        if (isGreetingFinished && isActive && !micStreamRef.current && displayedStatus === "listening") {
            activateMic();
        }
    }, [isGreetingFinished, isActive, displayedStatus]);

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
                if (audioContextRef.current) {
                    socket.send(JSON.stringify({
                        type: "config",
                        sampleRate: audioContextRef.current.sampleRate
                    }));
                }
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
                    }
                    if (data.detail) setStatusDetail(data.detail);
                }

                if (data.type === "search") {
                    setSearchResults(data.results);
                    addToHistory("system", `Found info: ${data.results.substring(0, 50)}...`);
                }

                if (data.type === "error") {
                    console.error("Agent Error:", data.message);
                    addToHistory("error", data.message);
                }
            };

            socket.onclose = () => stopRecording();
        } catch (err) {
            console.error("Connection Error:", err);
            setStatus("idle");
        }
    };

    const downloadTranscript = () => {
        const text = history.map(msg => `[${msg.timestamp.toLocaleString()}] ${msg.role.toUpperCase()}: ${msg.text}`).join("\n");
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nebula-transcript-${new Date().getTime()}.txt`;
        a.click();
    };

    const toggleSession = () => {
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
            <div className="relative flex min-h-full py-8 md:min-h-[calc(100vh-64px)] p-4 md:p-6 max-w-7xl mx-auto">
                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] md:w-[800px] md:h-[800px] bg-primary/10 rounded-full blur-[100px] animate-pulse-subtle" />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="z-10 mb-8"
                    >
                        <Badge className="px-5 py-2 glass-premium border-primary/20 text-primary tracking-[0.2em] uppercase text-[10px] font-bold animate-float">
                            {displayedStatus === "idle" ? "Connection Ready" :
                                displayedStatus === "listening" ? "Listening to You" :
                                    displayedStatus === "thinking" ? "Nebula is Thinking" :
                                        displayedStatus === "searching" ? `Searching: ${statusDetail}` : "Nebula is Speaking"}
                        </Badge>
                    </motion.div>

                    <div className="flex flex-col items-center gap-6 md:gap-12 w-full max-w-lg z-10">
                        <VoiceOrb status={displayedStatus} volume={volume} />

                        {/* History Panel */}
                        <div className="w-full max-w-md h-56 overflow-y-auto glass-premium p-6 space-y-4 mb-4 scrollbar-hide">
                            {history.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40">
                                    <MessageSquare className="h-6 w-6 text-primary" />
                                    <p className="text-center text-xs italic">Awaiting transmission...</p>
                                </div>
                            )}
                            <AnimatePresence mode="wait">
                                {history.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}
                                    >
                                        <div className={cn(
                                            "px-4 py-2.5 rounded-2xl max-w-[85%] text-sm shadow-sm",
                                            msg.role === "user"
                                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                                : msg.role === "error"
                                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                                    : "glass-premium bg-white/5 border-white/5 text-foreground rounded-tl-none"
                                        )}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[9px] opacity-40 mt-1 uppercase tracking-tighter px-1">
                                            {msg.role === "user" ? "You" : "Nebula"}
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            <div ref={historyEndRef} />
                        </div>

                        <div className="flex flex-col items-center gap-2 md:gap-4 text-center px-4">
                            <motion.h1
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-3xl md:text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-linear-to-b from-foreground to-foreground/40"
                            >
                                {displayedStatus === "idle" ? "NEBULA AI" :
                                    displayedStatus === "searching" ? "BROWSING..." : "HOW CAN I HELP?"}
                            </motion.h1>
                            <p className="text-[10px] md:text-xs text-muted-foreground max-w-sm uppercase tracking-[0.4em] font-mono opacity-60">
                                {isActive ? "Voice interface active" : "Session offline"}
                            </p>
                        </div>

                        <div className="flex items-center gap-6">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                    "h-20 w-20 md:h-24 md:w-24 rounded-full flex items-center justify-center transition-all duration-500",
                                    isActive
                                        ? "bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] text-white"
                                        : "bg-primary shadow-[0_0_30px_rgba(var(--primary),0.4)] text-primary-foreground"
                                )}
                                onClick={toggleSession}
                            >
                                {isActive ? <Square className="h-8 w-8 fill-current" /> : <Mic className="h-10 w-10" />}
                            </motion.button>

                            {history.length > 0 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-14 w-14 rounded-2xl glass-premium text-primary hover:bg-primary/10 border-white/10"
                                        onClick={downloadTranscript}
                                        title="Download Transcript"
                                    >
                                        <Download className="h-6 w-6" />
                                    </Button>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full max-w-4xl mx-auto mt-16 z-10 px-4">
                        <MetricCard icon={Activity} label="Latency" value={stats.latency} color="text-emerald-500" />
                        <MetricCard icon={Zap} label="Response" value={stats.turnTime} color="text-amber-500" />
                        <MetricCard icon={Cpu} label="Engine" value="Turbo" color="text-indigo-500" />
                        <MetricCard icon={ShieldCheck} label="Security" value="Secure" color="text-cyan-500" />
                    </div>
                </div>

                {/* Right Panel for Search Results */}
                <AnimatePresence>
                    {searchResults && (
                        <motion.div
                            initial={{ x: 400, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 400, opacity: 0 }}
                            className="hidden xl:flex flex-col w-[450px] border-l border-white/5 glass-premium rounded-none p-10 overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-primary/10 rounded-xl">
                                            <Globe className="h-6 w-6 text-primary" />
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tighter uppercase italic">Intelligence</h2>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest ml-1">Live Web Processing</p>
                                </div>
                                <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                    Live
                                </div>
                            </div>

                            <div className="space-y-8">
                                {searchResults.split('\n\n').filter(r => r.trim()).map((result, i) => {
                                    const lines = result.split('\n');
                                    const title = lines.find(l => l.startsWith('Title:'))?.replace('Title:', '').trim() || "Insight";
                                    const url = lines.find(l => l.startsWith('URL:'))?.replace('URL:', '').trim();
                                    const content = lines.find(l => l.startsWith('Content:'))?.replace('Content:', '').trim() || result;

                                    return (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                        >
                                            <Card className="p-6 glass-premium hover:bg-white/5 transition-all group border-white/5 hover:border-primary/20">
                                                <h3 className="text-base font-bold text-foreground mb-3 group-hover:text-primary transition-colors line-clamp-2">{title}</h3>
                                                <p className="text-sm text-muted-foreground leading-relaxed mb-6 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    {content}
                                                </p>
                                                {url && (
                                                    <div className="flex items-center justify-between">
                                                        <a
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 hover:opacity-70"
                                                        >
                                                            Resource <Globe className="h-3 w-3" />
                                                        </a>
                                                        <div className="w-12 h-0.5 bg-white/5 rounded-full" />
                                                    </div>
                                                )}
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                className="mt-12 h-12 glass-premium border-dashed border-primary/20 hover:bg-primary/5 text-xs font-black uppercase tracking-widest"
                                onClick={() => setSearchResults("")}
                            >
                                Clear Knowledge Base
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}


function MetricCard({ icon: Icon, label, value, color }) {
    return (
        <Card className="glass-premium p-4 md:p-6 flex items-center gap-4 md:gap-5 border-white/5 bg-white/5">
            <div className={cn("p-2.5 md:p-3 rounded-2xl bg-muted/10 shadow-inner", color)}>
                <Icon className="h-4 w-4 md:h-6 md:w-6" />
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="text-[9px] md:text-[11px] text-muted-foreground uppercase font-black tracking-widest">{label}</span>
                <span className="text-sm md:text-lg font-black text-foreground tabular-nums">{value}</span>
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
