"use client";

import { useState, useEffect } from "react";
import { Mic, Search, Settings, MessageSquare, BarChart3, Cloud, User, LogOut, PanelLeftClose, PanelLeftOpen, Menu, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "@/context/AuthContext";
import { useContext } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ children }) {
    const { isAuthenticated, user } = useContext(AuthContext);
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [recentConversations, setRecentConversations] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        const fetchRecent = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;

            setLoadingHistory(true);
            try {
                const resp = await fetch("http://localhost:8000/api/v1/voice/history", {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await resp.json();
                setRecentConversations(data.slice(0, 5));
            } catch (err) {
                console.error("Failed to fetch recent history:", err);
            } finally {
                setLoadingHistory(false);
            }
        };

        if (isAuthenticated) {
            fetchRecent();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
            if (!localStorage.getItem("token")) {
                router.push("/login");
            }
        }, 500);

        const handleResize = () => {
            if (window.innerWidth >= 768) setIsMobileOpen(false);
        };
        window.addEventListener("resize", handleResize);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", handleResize);
        }
    }, [router]);

    const sidebarContent = (
        <>
            <div className="flex h-16 items-center justify-between px-4">
                <Link href="/" className="flex items-center gap-2 px-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                        <Mic className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">VoiceAI</span>
                </Link>
                <div className="flex items-center gap-1 md:hidden">
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(false)}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <div className="hidden md:flex items-center gap-1">
                    <ThemeToggle />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setCollapsed(!collapsed)}
                    >
                        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col flex-1 gap-2 p-4 overflow-y-auto scrollbar-hide">
                <Button
                    variant="default"
                    className={cn(
                        "w-full justify-start gap-3 rounded-xl py-6 mb-2 shadow-lg shadow-primary/20",
                        collapsed ? "px-0 justify-center" : "px-4"
                    )}
                    onClick={() => window.location.href = "/dashboard"}
                >
                    <Sparkles className="h-5 w-5" />
                    {!collapsed && <span className="font-bold">New Intelligence</span>}
                </Button>

                <NavItem icon={Mic} label="Assistant" href="/dashboard" collapsed={collapsed} />
                <NavItem icon={MessageSquare} label="Conversations" href="/dashboard/conversations" collapsed={collapsed} />

                {(!collapsed || isMobileOpen) && (
                    <div className="mt-8 space-y-4">
                        <div className="px-3 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Recent Intelligence</span>
                        </div>
                        <div className="space-y-1">
                            {recentConversations.map((conv) => (
                                <Link
                                    key={conv.id}
                                    href={`/dashboard?id=${conv.id}`}
                                    className="flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all truncate group"
                                >
                                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100" />
                                    <span className="truncate">{conv.title || "Voice Session"}</span>
                                </Link>
                            ))}
                            {recentConversations.length === 0 && !loadingHistory && (
                                <p className="px-3 text-[10px] text-muted-foreground/40 italic">No recent sessions</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-8">
                    <NavItem icon={BarChart3} label="Observability" href="#" collapsed={collapsed} />
                    <NavItem icon={Search} label="Search History" href="#" collapsed={collapsed} />
                    <NavItem icon={Cloud} label="Integrations" href="#" collapsed={collapsed} />
                </div>
            </div>

            <div className="p-4 space-y-4">
                <Separator className="bg-border" />
                <NavItem icon={Settings} label="Settings" collapsed={collapsed} />

                <button
                    onClick={() => {
                        localStorage.removeItem("token");
                        window.location.href = "/login";
                    }}
                    className={cn(
                        "flex w-full items-center gap-3 rounded-xl p-3 text-sm font-medium transition-all text-red-500 hover:bg-red-500/10 border border-transparent",
                        collapsed ? "md:justify-center" : ""
                    )}
                >
                    <LogOut className="h-5 w-5" />
                    {(!collapsed || isMobileOpen) && <span>Logout</span>}
                </button>

                <div className={cn("flex items-center gap-3 p-3", collapsed ? "md:justify-center" : "")}>
                    <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'User'}`} />
                        <AvatarFallback>{user?.name?.substring(0, 2).toUpperCase() || "AI"}</AvatarFallback>
                    </Avatar>
                    {(!collapsed || isMobileOpen) && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium truncate">{user?.name || "User"}</span>
                            <span className="text-xs text-muted-foreground truncate">{user?.email || "Free Plan"}</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    if (isLoading) {
        return <div className="h-screen w-screen bg-background flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>;
    }

    if (!isAuthenticated) return null;

    return (
        <div className="flex h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden">
            <aside
                className={cn(
                    "hidden md:flex flex-col border-r border-border bg-card/50 backdrop-blur-xl transition-all duration-300",
                    collapsed ? "w-20" : "w-64"
                )}
            >
                {sidebarContent}
            </aside>

            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileOpen(false)}
                            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
                        />
                        <motion.aside
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-border bg-card shadow-2xl md:hidden"
                        >
                            {sidebarContent}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <header className="flex h-16 items-center justify-between px-4 border-b border-border bg-card/50 backdrop-blur-xl md:hidden">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(true)}>
                            <Menu className="h-6 w-6" />
                        </Button>
                        <Link href="/" className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                                <Mic className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <span className="font-bold">VoiceAI</span>
                        </Link>
                    </div>
                    <ThemeToggle />
                </header>

                <main className="flex-1 overflow-y-auto relative">
                    {children}
                </main>
            </div>
        </div>
    );
}

function NavItem({ icon: Icon, label, href = "#", active = false, collapsed = false }) {
    const router = useRouter();
    const isActive = active || (typeof window !== 'undefined' && window.location.pathname === href);

    return (
        <Link
            href={href}
            className={cn(
                "flex w-full items-center gap-3 rounded-xl p-3 text-sm font-medium transition-all",
                isActive
                    ? "bg-primary/10 text-primary shadow-[inset_0_0_12px_rgba(59,130,246,0.1)] border border-primary/20"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent",
                collapsed ? "justify-center" : ""
            )}
        >
            <Icon className="h-5 w-5" />
            {!collapsed && <span>{label}</span>}
        </Link>
    );
}
