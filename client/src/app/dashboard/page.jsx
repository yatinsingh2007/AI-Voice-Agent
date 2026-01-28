"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "./DashboardLayout";
import VoiceOrb from "@/components/VoiceOrb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Activity, Clock, Cpu, Globe, Zap, Download, Sparkles, MessageSquare, ShieldCheck, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { useSearchParams } from "next/navigation";

export default function DashboardPage() {
    const searchParams = useSearchParams();
    const conversationId = searchParams.get("id");

    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState("idle");
    const [statusDetail, setStatusDetail] = useState("");
    const [sources, setSources] = useState([]);
    const [stats, setStats] = useState({ latency: "0ms", turnTime: "0.0s" });
    const [volume, setVolume] = useState(0);
    const [isGreetingFinished, setIsGreetingFinished] = useState(false);
    const [displayedStatus, setDisplayedStatus] = useState("idle");

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
    const isPlayingRef = useRef(false);
    const isAiSpeakingRef = useRef(false);

    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    const addToHistory = (role, text) => {
        setHistory(prev => [...prev, { role, text, timestamp: new Date() }]);
    };

    // Load history if conversationId is provided
    useEffect(() => {
        if (conversationId) {
            const fetchConversation = async () => {
                try {
                    const token = localStorage.getItem("token");
                    const resp = await fetch(`http://localhost:8000/api/v1/voice/history/${conversationId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await resp.json();
                    if (data.messages) {
                        const formattedHistory = data.messages.map(m => ({
                            role: m.role,
                            text: m.content,
                            timestamp: new Date(m.created_at)
                        }));
                        setHistory(formattedHistory);
                    }
                } catch (err) {
                    console.error("Failed to fetch conversation history:", err);
                }
            };
            fetchConversation();
        } else {
            setHistory([]);
        }
    }, [conversationId]);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            if (audioRef.current.resetStream) {
                audioRef.current.resetStream();
            }
        }
        isPlayingRef.current = false;
    };

    useEffect(() => {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = context;

        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const audio = new Audio();
        audioRef.current = audio;

        // Use a ref for audio context to handle race conditions
        if (context.state === 'suspended') {
            const resume = () => {
                context.resume();
                window.removeEventListener('click', resume);
            };
            window.addEventListener('click', resume);
        }

        const initMediaSource = () => {
            if (mediaSourceRef.current) {
                try {
                    URL.revokeObjectURL(audio.src);
                } catch (e) { }
            }
            const ms = new MediaSource();
            mediaSourceRef.current = ms;
            audio.src = URL.createObjectURL(ms);

            ms.addEventListener('sourceopen', () => {
                if (MediaSource.isTypeSupported('audio/mpeg')) {
                    const sb = ms.addSourceBuffer('audio/mpeg');
                    sourceBufferRef.current = sb;

                    sb.addEventListener('updateend', () => {
                        if (audioQueueRef.current.length > 0 && !sb.updating) {
                            const chunk = audioQueueRef.current.shift();
                            try {
                                sb.appendBuffer(chunk);
                            } catch (e) {
                                console.error("SourceBuffer append error:", e);
                            }
                        }
                    });
                }
            });
        };

        // Initialize MediaSource
        initMediaSource();

        audio.onplay = () => {
            context.resume();
        };

        audioRef.current.resetStream = () => {
            initMediaSource();
            audioQueueRef.current = [];
        };

        // Metric update mock (simulating real-time updates)
        const metricInterval = setInterval(() => {
            if (isActive) {
                setStats(prev => ({
                    latency: `${Math.floor(Math.random() * 50 + 150)}ms`,
                    turnTime: `${(Math.random() * 0.5 + 1.2).toFixed(1)}s`
                }));
            }
        }, 5000);

        updateVolume();

        return () => {
            clearInterval(metricInterval);
            if (context.state !== 'closed') context.close();
        };
    }, []);

    const playOutputAudio = (arrayBuffer) => {
        const sb = sourceBufferRef.current;
        if (sb && !sb.updating && audioQueueRef.current.length === 0) {
            try {
                sb.appendBuffer(arrayBuffer);
            } catch (e) {
                console.error("Direct append error:", e);
                audioQueueRef.current.push(arrayBuffer);
            }
        } else {
            audioQueueRef.current.push(arrayBuffer);
        }

        if (audioRef.current.paused && (sb?.buffered.length > 0 || audioQueueRef.current.length > 0)) {
            audioRef.current.play().catch(e => console.debug("Autoplay block:", e));
        }
    };

    useEffect(() => {
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

            try {
                await audioContextRef.current.audioWorklet.addModule('/audio-processor.js');
            } catch (e) {
                console.debug("Worklet already loaded or failed:", e);
            }

            const source = audioContextRef.current.createMediaStreamSource(stream);
            const workletNode = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');

            source.connect(analyserRef.current);
            source.connect(workletNode);

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

    const [isAudioReallyPlaying, setIsAudioReallyPlaying] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handlePlaying = () => setIsAudioReallyPlaying(true);
        const handlePause = () => setIsAudioReallyPlaying(false);
        const handleEnded = () => setIsAudioReallyPlaying(false);

        audio.addEventListener('playing', handlePlaying);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('playing', handlePlaying);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    useEffect(() => {
        if (status === "speaking") {
            if (isAudioReallyPlaying) {
                setDisplayedStatus("speaking");
            } else {
                setDisplayedStatus("thinking");
            }
        } else if (status === "listening") {
            const timer = setTimeout(() => {
                setDisplayedStatus("listening");
                if (!isGreetingFinished) setIsGreetingFinished(true);
            }, 200);
            return () => clearTimeout(timer);
        } else {
            setDisplayedStatus(status);
        }
    }, [status, isAudioReallyPlaying, isGreetingFinished]);

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

                const token = localStorage.getItem("token");
                if (token) {
                    socket.send(JSON.stringify({ type: "auth", token }));
                }

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

                if (data.type === "user_text") {
                    addToHistory("user", data.text);
                }

                if (data.type === "ai_text") {
                    addToHistory("ai", data.text);
                }

                if (data.type === "clear_audio") {
                    stopAudio();
                }

                if (data.type === "search") {
                    setSources(data.results);
                    addToHistory("system", `Found ${data.results.length} sources...`);
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
            setSources([]);
            setStatusDetail("");
            startRecording();
        }
    };

    return (
        <DashboardLayout>
            <div className="relative flex flex-col min-h-full py-8 md:min-h-[calc(100vh-64px)] p-4 md:p-6 max-w-7xl mx-auto">
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

                        {/* Research Panel (Perplexity-style) */}
                        <AnimatePresence>
                            {sources.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    className="w-full space-y-3 mb-2"
                                >
                                    <div className="flex items-center gap-2 px-1">
                                        <Globe className="h-3 w-3 text-primary animate-pulse" />
                                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Sources Found</h3>
                                    </div>
                                    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide px-1">
                                        {sources.map((src, i) => (
                                            <motion.a
                                                key={i}
                                                href={src.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 w-40 glass-premium p-3 rounded-xl border-white/5 hover:border-primary/30 transition-all group relative overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="h-4 w-4 rounded bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                                        <img
                                                            src={`https://www.google.com/s2/favicons?domain=${new URL(src.url).hostname}&sz=32`}
                                                            alt=""
                                                            className="h-2.5 w-2.5"
                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] font-medium truncate opacity-60 flex-1">{new URL(src.url).hostname}</span>
                                                    <ExternalLink className="h-2 w-2 opacity-0 group-hover:opacity-60 transition-opacity" />
                                                </div>
                                                <h4 className="text-[10px] font-bold line-clamp-1 mb-1 group-hover:text-primary transition-colors">{src.title}</h4>
                                                <p className="text-[8px] line-clamp-2 opacity-40 leading-relaxed">{src.content}</p>
                                            </motion.a>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* History Panel */}
                        <div className="w-full max-w-md h-56 overflow-y-auto glass-premium p-6 space-y-4 mb-4 scrollbar-hide">
                            {history.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40">
                                    <MessageSquare className="h-6 w-6 text-primary" />
                                    <p className="text-center text-xs italic">Awaiting transmission...</p>
                                </div>
                            )}
                            <AnimatePresence mode="popLayout">
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
                                className="text-3xl md:text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-linear-to-b from-foreground to-foreground/40 text-center"
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
