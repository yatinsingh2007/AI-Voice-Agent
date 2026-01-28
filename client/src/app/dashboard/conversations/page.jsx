"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "../DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Calendar, ChevronRight, Clock, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import axios from "axios";
import { format } from "date-fns";

export default function ConversationsPage() {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem("token");
            const resp = await axios.get("http://localhost:8000/api/v1/voice/history", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConversations(resp.data);
        } catch (err) {
            console.error("Failed to fetch history:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 max-w-5xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Your Conversations</h1>
                        <p className="text-muted-foreground mt-1">Review your past interactions with Nebula AI</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                ) : conversations.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center p-12 text-center bg-muted/30 border-dashed border-2">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <MessageSquare className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold">No conversations yet</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm">
                            Start a new session with the assistant to see your history appear here.
                        </p>
                        <Button className="mt-6" onClick={() => window.location.href = "/dashboard"}>
                            Start Talking
                        </Button>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {conversations.map((conv, idx) => (
                            <motion.div
                                key={conv.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <Link href={`/dashboard?id=${conv.id}`}>
                                    <Card className="group p-4 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer border border-border bg-card/50 backdrop-blur-md">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                                    <MessageSquare className="h-6 w-6 text-primary" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg">{conv.title || "Voice Session"}</h3>
                                                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            {format(new Date(conv.created_at), "MMM d, yyyy")}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            {format(new Date(conv.created_at), "p")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                        </div>
                                    </Card>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
