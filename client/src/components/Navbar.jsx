import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export default function Navbar() {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl transition-colors duration-300">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                        <Mic className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-foreground">VoiceAI</span>
                </Link>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <Link href="/login">
                        <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                            Sign In
                        </Button>
                    </Link>
                    <Link href="/signup">
                        <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                            Get Started
                        </Button>
                    </Link>
                </div>
            </div>
        </nav>
    );
}
