"use client";
import { useContext, useState } from "react"
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, ArrowLeft } from "lucide-react";
import { ThemeContext } from "@/context/ThemeContext"
import Link from "next/link";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const { theme } = useContext(ThemeContext);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            // FastAPI OAuth2PasswordRequestForm expects form-data
            const formData = new FormData();
            formData.append("username", email);
            formData.append("password", password);

            const resp = await axios.post("http://localhost:8000/api/v1/auth/login", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            if (resp.data.access_token) {
                localStorage.setItem("token", resp.data.access_token);
                router.push("/dashboard");
            }
        } catch (err) {
            console.error("Login failed:", err);
            setError(err.response?.data?.detail || "Login failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    }

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
            <div className="absolute top-1/2 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-[400px]"
            >
                <div className="mb-8 text-center">
                    <Link href="/" className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
                        <Mic className="h-6 w-6 text-primary-foreground" />
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
                    <p className="mt-2 text-muted-foreground">Continue your conversation with VoiceAI</p>
                </div>

                <Card className="glass border-border p-6 space-y-6">
                    <form onSubmit={handleLogin}>
                        <div className="space-y-4">
                            {error && (
                                <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded border border-red-500/20">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground focus:ring-primary"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-muted-foreground">Password</Label>
                                    <Link href="#" className="text-xs text-primary hover:underline">Forgot password?</Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    className="bg-background/50 border-border text-foreground focus:ring-primary"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20 mt-6"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Signing In..." : "Sign In"}
                        </Button>
                    </form>
                </Card>

                <p className="mt-8 text-center text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Link href="/signup" className="text-primary font-medium hover:underline">
                        Sign up for free
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
