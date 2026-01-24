"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
            <Link
                href="/"
                className="absolute top-8 left-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to home
            </Link>
            <div className="absolute top-0 left-0 -z-10 h-full w-full bg-grid opacity-10 dark:opacity-20" />
            <div className="absolute bottom-0 right-0 -z-10 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full bg-blue-500/10 blur-[100px]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-[450px]"
            >
                <div className="mb-8 text-center">
                    <Link href="/" className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
                        <Mic className="h-6 w-6 text-primary-foreground" />
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Get started today</h1>
                    <p className="mt-2 text-muted-foreground">Join 10,000+ users talking to the future</p>
                </div>

                <Card className="glass border-border p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-muted-foreground">Full Name</Label>
                            <Input
                                id="name"
                                placeholder="John Doe"
                                className="bg-background/50 border-border text-foreground focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                className="bg-background/50 border-border text-foreground focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-muted-foreground">Create Password</Label>
                            <Input
                                id="password"
                                type="password"
                                className="bg-background/50 border-border text-foreground focus:ring-primary"
                            />
                        </div>
                    </div>

                    <Button className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20">
                        Create Account
                    </Button>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                            <span className="text-xs text-muted-foreground leading-relaxed">By signing up, you agree to our Terms and Privacy Policy.</span>
                        </div>
                    </div>
                </Card>

                <p className="mt-8 text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login" className="text-primary font-medium hover:underline">
                        Sign in here
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
