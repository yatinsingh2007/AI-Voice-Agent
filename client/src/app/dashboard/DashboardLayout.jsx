"use client";

import { useState, useEffect } from "react";
import { Mic, Search, Settings, MessageSquare, BarChart3, Cloud, User, LogOut, PanelLeftClose, PanelLeftOpen, Menu, X } from "lucide-react";
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

    useEffect(() => {
        // Give AuthContext a moment to initialize from localStorage
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

            <div className="flex-1 space-y-2 p-4 overflow-y-auto">
                <NavItem icon={MessageSquare} label="Conversations" active collapsed={collapsed} />
                <NavItem icon={BarChart3} label="Observability" collapsed={collapsed} />
                <NavItem icon={Search} label="Search History" collapsed={collapsed} />
                <NavItem icon={Cloud} label="Integrations" collapsed={collapsed} />
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
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    {(!collapsed || isMobileOpen) && (
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">John Doe</span>
                            <span className="text-xs text-muted-foreground">Free Plan</span>
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

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Mobile Top Header */}
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

function NavItem({ icon: Icon, label, active = false, collapsed = false }) {
    return (
        <button
            className={cn(
                "flex w-full items-center gap-3 rounded-xl p-3 text-sm font-medium transition-all",
                active
                    ? "bg-primary/10 text-primary shadow-[inset_0_0_12px_rgba(59,130,246,0.1)] border border-primary/20"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent",
                collapsed ? "justify-center" : ""
            )}
        >
            <Icon className="h-5 w-5" />
            {!collapsed && <span>{label}</span>}
        </button>
    );
}
