import { Card } from "@/components/ui/card";
import { Zap, Search, MessageSquare, Headphones, ShieldCheck, Cpu } from "lucide-react";

const features = [
    {
        title: "Ultra Low Latency",
        description: "Response times under 1 second for a natural, human-like conversation flow.",
        icon: Zap,
        color: "text-yellow-400",
    },
    {
        title: "Real-time Web Search",
        description: "Connects to the internet to provide current and accurate information instantly.",
        icon: Search,
        color: "text-blue-400",
    },
    {
        title: "Natural Turn Detection",
        description: "Intelligent VAD and turn detection that understands when you're finished speaking.",
        icon: MessageSquare,
        color: "text-purple-400",
    },
    {
        title: "Barge-in Support",
        description: "Interrupt the agent mid-sentence just like a real conversation. It listens instantly.",
        icon: Headphones,
        color: "text-green-400",
    },
    {
        title: "Context Awareness",
        description: "Update context dynamically via API during active sessions to steer the agent.",
        icon: Cpu,
        color: "text-red-400",
    },
    {
        title: "Multi-User Sessions",
        description: "Architected for scale. Isolated sessions supporting thousands of concurrent users.",
        icon: ShieldCheck,
        color: "text-cyan-400",
    },
];

export default function Features() {
    return (
        <section id="features" className="relative py-24">
            <div className="container mx-auto px-6">
                <div className="mb-16 text-center">
                    <h2 className="mb-4 text-3xl font-bold text-foreground md:text-5xl tracking-tight">
                        Engineered for <span className="text-primary italic">Performance</span>
                    </h2>
                    <p className="mx-auto max-w-2xl text-muted-foreground">
                        A cascading voice pipeline built from the ground up for production-ready voice interactions.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature, i) => (
                        <Card key={i} className="glass p-8 transition-all hover:scale-[1.02] hover:bg-muted/50 border-border">
                            <feature.icon className={`mb-4 h-8 w-8 ${feature.color}`} />
                            <h3 className="mb-2 text-xl font-bold text-foreground">{feature.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
