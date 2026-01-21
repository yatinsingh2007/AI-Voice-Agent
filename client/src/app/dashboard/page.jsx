"use client";

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "./DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Play, Square, Send, Globe, Zap, Cpu, Activity, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
    const [isActive, setIsActive] = useState(false);
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Hello! I'm your VoiceAI assistant. How can I help you today?", timestamp: new Date().toLocaleTimeString() },
    ]);
    const [status, setStatus] = useState("idle");
    const [stats, setStats] = useState({ latency: "0ms", turnTime: "0.0s" });

    const scrollRef = useRef(null);
    const socketRef = useRef(null);
    const mediaRecorderRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
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

            // Connect to WebSocket
            const socket = new WebSocket("ws://localhost:8000/api/v1/voice/stream");
            socketRef.current = socket;

            socket.onopen = () => {
                console.log("WebSocket Connected");
                setStatus("listening");

                const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                        socket.send(event.data);
                    }
                };

                mediaRecorder.start(250);
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === "transcript") {
                    setMessages(prev => {
                        const lastMsg = prev[prev.length - 1];
                        if (lastMsg && lastMsg.partial) {
                            return [...prev.slice(0, -1), { ...lastMsg, content: data.content }];
                        }
                        return [...prev, { role: "user", content: data.content, timestamp: new Date().toLocaleTimeString(), partial: !data.is_final }];
                    });
                }
                if (data.type === "status") {
                    setStats({ latency: `${data.metrics.vad + data.metrics.stt}ms`, turnTime: "0.4s" });
                }
            };

            socket.onclose = () => {
                console.log("WebSocket Closed");
                stopRecording();
            };

            setIsActive(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            setStatus("idle");
        }
    };

    const toggleSession = () => {
        if (isActive) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <DashboardLayout>
            <div className="flex h-full p-6 gap-6">
                {/* Left Side: Session View */}
                <div className="flex flex-1 flex-col gap-6">
                    {/* Status Bar */}
                    <div className="grid grid-cols-4 gap-4">
                        <MetricCard icon={Activity} label="Latency" value={stats.latency} trend="-5ms" color="text-green-400" />
                        <MetricCard icon={Clock} label="Turn Time" value={stats.turnTime} trend="+10ms" color="text-yellow-400" />
                        <MetricCard icon={Cpu} label="Processing" value={isActive ? "Active" : "Standby"} color="text-blue-400" />
                        <MetricCard icon={Globe} label="Search" value="Enabled" color="text-cyan-400" />
                    </div>

                    <Card className="flex flex-1 flex-col glass border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4">
                            <Badge variant="outline" className="bg-white/5 border-white/10 uppercase tracking-widest text-[10px]">
                                Active Session
                            </Badge>
                        </div>

                        <div className="flex-1 flex flex-col p-6">
                            <ScrollArea className="flex-1 pr-4 mb-4" ref={scrollRef}>
                                <div className="flex flex-col gap-6">
                                    {messages.map((msg, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "flex flex-col max-w-[80%]",
                                                msg.role === "user" ? "ml-auto items-end" : "items-start"
                                            )}
                                        >
                                            <div className={cn(
                                                "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                                msg.role === "user"
                                                    ? "bg-primary text-white"
                                                    : "bg-white/5 border border-white/10 text-zinc-300"
                                            )}>
                                                {msg.content}
                                            </div>
                                            <span className="mt-1 text-[10px] text-zinc-500 uppercase font-mono">{msg.timestamp}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </ScrollArea>


                            <div className="flex flex-col items-center gap-6 mt-4">
                                {/* Visualizer */}
                                <div className="flex items-center gap-1 h-12">
                                    {[...Array(isActive ? 12 : 5)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            animate={status === "listening" || status === "speaking" ? {
                                                height: [4, status === "listening" ? 32 : 48, 4],
                                            } : { height: 4 }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                delay: i * 0.1,
                                            }}
                                            className={cn(
                                                "w-1.5 rounded-full transition-colors duration-500",
                                                status === "listening" ? "bg-primary" :
                                                    status === "speaking" ? "bg-green-400" :
                                                        "bg-zinc-700"
                                            )}
                                        />
                                    ))}
                                </div>

                                <div className="flex items-center gap-4">
                                    <Button
                                        size="lg"
                                        className={cn(
                                            "h-16 w-16 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105",
                                            isActive ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : "bg-primary hover:bg-primary/90 shadow-primary/20"
                                        )}
                                        onClick={toggleSession}
                                    >
                                        {isActive ? <Square className="h-7 w-7 fill-white" /> : <Mic className="h-8 w-8 text-white" />}
                                    </Button>

                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white uppercase tracking-widest leading-none mb-1">
                                            {status === "idle" ? "Standby" :
                                                status === "listening" ? "Listening..." :
                                                    status === "thinking" ? "Thinking..." : "Speaking"}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 font-mono uppercase">
                                            {isActive ? "Audio stream active" : "Press to start"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>


                <div className="w-[380px] flex flex-col gap-6">
                    <Card className="glass border-white/5 p-6 space-y-4">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-primary" />
                            Dynamic Context
                        </h3>
                        <p className="text-xs text-zinc-500">Update the agent's persona or knowledge base mid-session.</p>
                        <Separator className="bg-white/5" />

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono text-zinc-500 uppercase">Current Persona</label>
                                <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-zinc-300 italic">
                                    "You are a helpful technical assistant specialized in Next.js and high-performance Web APIs."
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-mono text-zinc-500 uppercase">Knowledge Base Update</label>
                                <textarea
                                    className="w-full h-32 rounded-lg bg-black border border-white/10 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
                                    placeholder="Paste new context or instructions here..."
                                />
                            </div>

                            <Button className="w-full bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30">
                                Push Update
                            </Button>
                        </div>
                    </Card>

                    <Card className="flex-1 glass border-white/5 p-6 flex flex-col">
                        <h3 className="font-bold text-white flex items-center gap-2 mb-6">
                            <Zap className="h-4 w-4 text-yellow-400" />
                            Pipeline Metrics
                        </h3>

                        <div className="space-y-6">
                            <MetricItem label="VAD Detection" value="24ms" progress={20} />
                            <MetricItem label="STT (Deepgram)" value="156ms" progress={45} />
                            <MetricItem label="LLM (Groq)" value="280ms" progress={60} />
                            <MetricItem label="TTS (Cartesia)" value="92ms" progress={30} />
                            <MetricItem label="Total E2E" value="552ms" progress={40} color="bg-primary" />
                        </div>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}

function MetricCard({ icon: Icon, label, value, trend, color }) {
    return (
        <Card className="glass border-white/5 p-4 flex items-center gap-4">
            <div className={cn("p-2 rounded-lg bg-white/5", color)}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase font-mono">{label}</span>
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{value}</span>
                    {trend && <span className={cn("text-[10px] font-mono", trend.startsWith('-') ? "text-green-400" : "text-red-400")}>{trend}</span>}
                </div>
            </div>
        </Card>
    );
}

function MetricItem({ label, value, progress, color = "bg-white/20" }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-500 uppercase">{label}</span>
                <span className="text-white font-bold">{value}</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={cn("h-full rounded-full", color)}
                />
            </div>
        </div>
    );
}

