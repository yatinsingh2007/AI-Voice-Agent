"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, Github, Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-black px-6 py-12">
            <div className="absolute top-0 left-0 -z-10 h-full w-full bg-grid opacity-20" />
            <div className="absolute bottom-0 right-0 -z-10 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full bg-blue-500/10 blur-[100px]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-[450px]"
            >
                <div className="mb-8 text-center">
                    <Link href="/" className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
                        <Mic className="h-6 w-6 text-white" />
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Get started today</h1>
                    <p className="mt-2 text-zinc-400">Join 10,000+ users talking to the future</p>
                </div>

                <Card className="glass border-white/5 p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="first-name" className="text-zinc-400">First Name</Label>
                            <Input
                                id="first-name"
                                className="bg-black/50 border-white/10 text-white focus:ring-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="last-name" className="text-zinc-400">Last Name</Label>
                            <Input
                                id="last-name"
                                className="bg-black/50 border-white/10 text-white focus:ring-primary"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-zinc-400">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            className="bg-black/50 border-white/10 text-white focus:ring-primary"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password" text-zinc-400>Create Password</Label>
                        <Input
                            id="password"
                            type="password"
                            className="bg-black/50 border-white/10 text-white focus:ring-primary"
                        />
                        <p className="text-[10px] text-zinc-500">Must be at least 8 characters with a symbol.</p>
                    </div>

                    <Button className="w-full h-11 bg-primary text-white hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20">
                        Create Account
                    </Button>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                            <span className="text-xs text-zinc-400 leading-relaxed">By signing up, you agree to our Terms and Privacy Policy.</span>
                        </div>
                    </div>
                </Card>

                <p className="mt-8 text-center text-sm text-zinc-500">
                    Already have an account?{" "}
                    <Link href="/login" className="text-primary font-medium hover:underline">
                        Sign in here
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
