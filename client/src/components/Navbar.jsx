import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import Link from "next/link";

export default function Navbar() {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/20 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                        <Mic className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">VoiceAI</span>
                </Link>
                <div className="flex items-center gap-4">
                    <Link href="/login">
                        <Button variant="ghost" className="text-zinc-400 hover:text-white">
                            Sign In
                        </Button>
                    </Link>
                    <Link href="/signup">
                        <Button className="rounded-full bg-white text-black hover:bg-zinc-200">
                            Get Started
                        </Button>
                    </Link>
                </div>
            </div>
        </nav>
    );
}
