"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function Hero() {
    return (
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-20">
            <div className="absolute top-1/2 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />
            <div className="absolute top-0 left-0 -z-10 h-full w-full bg-grid opacity-20" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="container px-6 text-center"
            >
                <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-blue-100">Now with Real-time Web Search</span>
                </div>

                <h1 className="mx-auto mb-8 max-w-4xl text-5xl font-extrabold tracking-tight text-white md:text-7xl lg:text-8xl">
                    Talk to the <span className="text-glow bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Future</span> of AI
                </h1>

                <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400 md:text-xl">
                    A production-ready, low-latency voice assistant that feels like talking to a real person.
                    Context-aware, interruptible, and incredibly fast.
                </p>

                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <Link href="/dashboard">
                        <Button size="lg" className="h-14 rounded-full bg-primary px-8 text-lg font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:scale-105">
                            Start Conversation
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </section>
    );
}
