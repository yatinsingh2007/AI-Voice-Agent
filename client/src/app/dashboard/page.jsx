"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "./DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Activity, Clock, Cpu, Globe, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const VoiceOrb = ({ status, volume }) => {
    const scale = 1 + volume * 2;

    const variants = {
        idle: {
            scale: [1, 1.05, 1],
            transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(79, 70, 229, 0) 70%)",
        },
        listening: {
            scale: scale,
            transition: { type: "spring", stiffness: 300, damping: 20 },
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.6) 0%, rgba(79, 70, 229, 0) 70%)",
        },
        thinking: {
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
            transition: { duration: 2, repeat: Infinity, ease: "linear" },
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.6) 0%, rgba(124, 58, 237, 0) 70%)",
        },
        speaking: {
            scale: [1, 1.1, 1],
            transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
            background: "radial-gradient(circle, rgba(34, 197, 94, 0.6) 0%, rgba(22, 163, 74, 0) 70%)",
        }
    };

    return (
        <div className="relative flex items-center justify-center w-64 h-64">
            {/* Outer Glow */}
            <motion.div
                animate={status}
                variants={variants}
                className="absolute inset-0 rounded-full blur-3xl opacity-50"
            />

            {/* Main Orb */}
            <motion.div
                animate={status}
                variants={variants}
                className={cn(
                    "relative w-48 h-48 rounded-full border border-white/10 shadow-2xl backdrop-blur-sm overflow-hidden",
                    "bg-linear-to-br from-primary/30 to-background/50"
                )}
            >
                {/* Surface Waves */}
                <motion.div
                    animate={{
                        y: [-10, 10, -10],
                        x: [-5, 5, -5],
                    }}
                    transition={{ duration: 5, repeat: Infinity }}
                    className="absolute inset-0 bg-primary/10 mix-blend-overlay"
                />

                {/* Core Light */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-white/5 blur-xl" />
                </div>
            </motion.div>
        </div>
    );
};

export default function DashboardPage() {
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState("idle");
    const [stats, setStats] = useState({ latency: "0ms", turnTime: "0.0s" });
    const [volume, setVolume] = useState(0);

    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);

    // Auto-start session on mount
    useEffect(() => {
        startRecording();
        return () => stopRecording();
    }, []);

    const updateVolume = () => {
        if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            setVolume(average / 128); // Normalize to 0-1 range
        }
        animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    const playOutputAudio = async (arrayBuffer) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }

        try {
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer).catch(e => {
                console.log("Audio chunk received");
            });

            if (audioBuffer) {
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.start();
            }
        } catch (e) {
            console.error("Playback error:", e);
        }
    };

    const stopRecording = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            audioContextRef.current.close();
        }
        if (socketRef.current) {
            socketRef.current.close();
        }
        setIsActive(false);
        setStatus("idle");
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const socket = new WebSocket("ws://localhost:8000/api/v1/voice/stream");
            socketRef.current = socket;

            socket.onopen = () => {
                console.log("Nebula Connected");
                setStatus("listening");

                const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
                audioContextRef.current = audioContext;

                const source = audioContext.createMediaStreamSource(stream);

                // Analyser for UI reactivity
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyserRef.current = analyser;
                updateVolume();

                // Cleaning Pipeline
                const filter = audioContext.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 80;

                const compressor = audioContext.createDynamicsCompressor();
                compressor.threshold.setValueAtTime(-50, audioContext.currentTime);

                const processor = audioContext.createScriptProcessor(4096, 1, 1);

                source.connect(analyser);
                analyser.connect(filter);
                filter.connect(compressor);
                compressor.connect(processor);
                processor.connect(audioContext.destination);

                processor.onaudioprocess = (e) => {
                    if (socket.readyState === WebSocket.OPEN) {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmData = new Int16Array(inputData.length);
                        for (let i = 0; i < inputData.length; i++) {
                            const s = Math.max(-1, Math.min(1, inputData[i]));
                            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                        }
                        socket.send(pcmData.buffer);
                    }
                };
            };

            socket.onmessage = async (event) => {
                if (event.data instanceof Blob) {
                    const arrayBuffer = await event.data.arrayBuffer();
                    playOutputAudio(arrayBuffer);
                    return;
                }

                const data = JSON.parse(event.data);
                if (data.type === "status") {
                    if (data.status) setStatus(data.status);
                    if (data.metrics) {
                        setStats({
                            latency: `${data.metrics.vad + data.metrics.stt}ms`,
                            turnTime: "0.4s"
                        });
                    }
                }
            };

            socket.onclose = () => stopRecording();
            setIsActive(true);
        } catch (err) {
            console.error("Mic Error:", err);
            setStatus("idle");
        }
    };

    const toggleSession = () => {
        if (isActive) stopRecording();
        else startRecording();
    };

    return (
        <DashboardLayout>
            <div className="relative flex flex-col items-center justify-center h-[calc(100vh-100px)] p-6 overflow-hidden">
                {/* Background Decor */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
                </div>

                {/* Status Badge */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-8"
                >
                    <Badge variant="outline" className="px-4 py-1.5 bg-muted/50 border-primary/20 backdrop-blur-md text-primary tracking-widest uppercase text-[10px] font-bold">
                        {status === "idle" ? "Connection Ready" :
                            status === "listening" ? "Listening to You" :
                                status === "thinking" ? "Nebula is Thinking" : "Nebula is Speaking"}
                    </Badge>
                </motion.div>

                {/* Main Orb Focal Point */}
                <div className="flex flex-col items-center gap-12">
                    <VoiceOrb status={status} volume={volume} />

                    <div className="flex flex-col items-center gap-4 text-center">
                        <motion.h1
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-4xl font-bold tracking-tight text-foreground"
                        >
                            {status === "idle" ? "Nebula AI" : "How can I help you?"}
                        </motion.h1>
                        <p className="text-sm text-muted-foreground max-w-sm uppercase tracking-[0.2em] font-mono">
                            {isActive ? "Voice interface active" : "Session disconnected"}
                        </p>
                    </div>

                    <Button
                        size="lg"
                        className={cn(
                            "h-20 w-20 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110",
                            isActive ? "bg-red-500/20 text-red-500 border-red-500/50 hover:bg-red-500/30" : "bg-primary text-primary-foreground"
                        )}
                        onClick={toggleSession}
                    >
                        {isActive ? <Square className="h-8 w-8 fill-current" /> : <Mic className="h-10 w-10" />}
                    </Button>
                </div>

                {/* Metrics Overlay */}
                <div className="absolute bottom-8 left-8 right-8 grid grid-cols-4 gap-4 max-w-4xl mx-auto">
                    <MetricCard icon={Activity} label="Latency" value={stats.latency} color="text-green-500" />
                    <MetricCard icon={Zap} label="Response" value={stats.turnTime} color="text-yellow-500" />
                    <MetricCard icon={Cpu} label="System" value="Active" color="text-blue-500" />
                    <MetricCard icon={Globe} label="Access" value="Neural" color="text-cyan-500" />
                </div>
            </div>
        </DashboardLayout>
    );
}

function MetricCard({ icon: Icon, label, value, color }) {
    return (
        <Card className="glass border-border/50 bg-background/20 backdrop-blur-sm p-4 flex items-center gap-4">
            <div className={cn("p-2 rounded-lg bg-muted/20", color)}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase font-mono">{label}</span>
                <span className="text-sm font-bold text-foreground">{value}</span>
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
