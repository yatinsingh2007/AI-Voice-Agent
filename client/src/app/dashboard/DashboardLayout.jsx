"use client";

import { useState } from "react";
import { Mic, Search, Settings, MessageSquare, BarChart3, Cloud, User, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function DashboardLayout({ children }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex h-screen bg-black text-white font-sans selection:bg-primary/30">
            {/* Sidebar */}
            <aside
                className={cn(
                    "relative flex flex-col border-r border-white/5 bg-zinc-950/50 backdrop-blur-xl transition-all duration-300",
                    collapsed ? "w-20" : "w-64"
                )}
            >
                <div className="flex h-16 items-center justify-between px-6">
                    {!collapsed && (
                        <Link href="/" className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                                <Mic className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-xl font-bold tracking-tight">VoiceAI</span>
                        </Link>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-400 hover:text-white"
                        onClick={() => setCollapsed(!collapsed)}
                    >
                        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                    </Button>
                </div>

                <div className="flex-1 space-y-2 p-4">
                    <NavItem icon={MessageSquare} label="Conversations" active collapsed={collapsed} />
                    <NavItem icon={BarChart3} label="Observability" collapsed={collapsed} />
                    <NavItem icon={Search} label="Search History" collapsed={collapsed} />
                    <NavItem icon={Cloud} label="Integrations" collapsed={collapsed} />
                </div>

                <div className="p-4 space-y-4">
                    <Separator className="bg-white/5" />
                    <NavItem icon={Settings} label="Settings" collapsed={collapsed} />

                    <div className={cn("flex items-center gap-3 p-3", collapsed ? "justify-center" : "")}>
                        <Avatar className="h-9 w-9 border border-white/10">
                            <AvatarImage src="https://github.com/shadcn.png" />
                            <AvatarFallback>JD</AvatarFallback>
                        </Avatar>
                        {!collapsed && (
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">John Doe</span>
                                <span className="text-xs text-zinc-500">Free Plan</span>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {children}
            </main>
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
                    : "text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent",
                collapsed ? "justify-center" : ""
            )}
        >
            <Icon className="h-5 w-5" />
            {!collapsed && <span>{label}</span>}
        </button>
    );
}
