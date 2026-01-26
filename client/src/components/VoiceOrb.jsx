"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const VoiceOrb = ({ status, volume }) => {
    const scale = 1 + volume * 2;

    const variants = {
        idle: {
            scale: [1, 1.05, 1],
            transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(79, 70, 229, 0) 70%)",
        },
        listening: {
            scale: scale,
            transition: { type: "spring", stiffness: 300, damping: 20 },
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.6) 0%, rgba(79, 70, 229, 0) 70%)",
        },
        thinking: {
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
            transition: { duration: 2, repeat: Infinity, ease: "linear" },
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.6) 0%, rgba(124, 58, 237, 0) 70%)",
        },
        speaking: {
            scale: [1, 1.1, 1],
            transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
            background: "radial-gradient(circle, rgba(34, 197, 94, 0.6) 0%, rgba(22, 163, 74, 0) 70%)",
        }
    };

    return (
        <div className="relative flex items-center justify-center w-48 h-48 md:w-64 md:h-64">
            {/* Outer Glow */}
            <motion.div
                animate={status}
                variants={variants}
                className="absolute inset-0 rounded-full blur-3xl opacity-50"
            />

            {/* Main Orb */}
            <motion.div
                animate={status}
                variants={variants}
                className={cn(
                    "relative w-32 h-32 md:w-48 md:h-48 rounded-full border border-white/10 shadow-2xl backdrop-blur-sm overflow-hidden",
                    "bg-linear-to-br from-primary/30 to-background/50"
                )}
            >
                {/* Surface Waves */}
                <motion.div
                    animate={{
                        y: [-10, 10, -10],
                        x: [-5, 5, -5],
                    }}
                    transition={{ duration: 5, repeat: Infinity }}
                    className="absolute inset-0 bg-primary/10 mix-blend-overlay"
                />

                {/* Core Light */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/5 blur-xl" />
                </div>
            </motion.div>
        </div>
    );
};

export default VoiceOrb;
