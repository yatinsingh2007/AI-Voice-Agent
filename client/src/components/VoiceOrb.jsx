"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const VoiceOrb = ({ status, volume }) => {
    const scale = 1 + volume * 1.5;

    const variants = {
        idle: {
            scale: [1, 1.05, 1],
            transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            background: "radial-gradient(circle, oklch(0.6 0.2 250 / 0.3) 0%, transparent 70%)",
        },
        listening: {
            scale: scale,
            transition: { type: "spring", stiffness: 300, damping: 20 },
            background: "radial-gradient(circle, oklch(0.6 0.2 250 / 0.5) 0%, transparent 70%)",
        },
        thinking: {
            scale: [1, 1.15, 1],
            rotate: [0, 180, 360],
            transition: { duration: 3, repeat: Infinity, ease: "linear" },
            background: "radial-gradient(circle, oklch(0.7 0.2 280 / 0.5) 0%, transparent 70%)",
        },
        speaking: {
            scale: scale,
            transition: { type: "spring", stiffness: 300, damping: 20 },
            background: "radial-gradient(circle, oklch(0.8 0.2 150 / 0.5) 0%, transparent 70%)",
        }
    };

    return (
        <div className="relative flex items-center justify-center w-48 h-48 md:w-80 md:h-80">
            {/* Background Glow Layers */}
            <motion.div
                animate={status}
                variants={variants}
                className="absolute inset-0 rounded-full blur-[80px] opacity-40 mix-blend-screen"
            />
            <motion.div
                animate={status}
                variants={variants}
                className="absolute inset-4 rounded-full blur-2xl opacity-20 mix-blend-overlay border border-white/5"
            />

            {/* Reactive Rings */}
            <AnimatePresence>
                {(status === "speaking" || status === "listening") && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.2 + volume, opacity: 0.3 }}
                        exit={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 rounded-full border-2 border-primary/30 blur-sm"
                    />
                )}
            </AnimatePresence>

            {/* Main Orb */}
            <motion.div
                animate={status}
                variants={variants}
                className={cn(
                    "relative w-40 h-40 md:w-56 md:h-56 rounded-full border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.1)] backdrop-blur-md overflow-hidden",
                    "bg-linear-to-br from-white/10 via-primary/20 to-black/40"
                )}
            >
                {/* Internal Fluid Effect */}
                <motion.div
                    animate={{
                        y: [-20, 20, -20],
                        x: [-10, 10, -10],
                        rotate: [0, 360],
                        scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent,oklch(0.7_0.2_250/0.2),transparent)] opacity-40"
                />

                {/* Core Light Shine */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2)_0%,transparent_50%)]" />

                {/* Dynamic Center */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                        animate={{
                            scale: status === "thinking" ? [1, 1.2, 1] : 1,
                            opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-20 h-20 md:w-32 md:h-32 rounded-full bg-primary/20 blur-2xl"
                    />
                </div>
            </motion.div>

            {/* Orbital Dust/Particles (SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                <filter id="gooey">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                    <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                </filter>
            </svg>
        </div>
    );
};

export default VoiceOrb;
