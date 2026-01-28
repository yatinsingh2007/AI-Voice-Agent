"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const HeartbeatSensor = ({ status, volume }) => {
    const canvasRef = useRef(null);
    const pointsRef = useRef([]);
    const scanXRef = useRef(0);
    const lastTimeRef = useRef(0);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const updateDimensions = () => {
            if (canvasRef.current) {
                const parent = canvasRef.current.parentElement;
                setDimensions({
                    width: parent.clientWidth,
                    height: parent.clientHeight
                });
            }
        };
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    useEffect(() => {
        if (!dimensions.width) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationId;

        const draw = (time) => {
            const deltaTime = time - lastTimeRef.current;
            lastTimeRef.current = time;

            ctx.clearRect(0, 0, dimensions.width, dimensions.height);

            const gridStep = 40;
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.05)';
            ctx.lineWidth = 1;

            ctx.beginPath();
            for (let x = 0; x <= dimensions.width; x += gridStep) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, dimensions.height);
            }
            for (let y = 0; y <= dimensions.height; y += gridStep) {
                ctx.moveTo(0, y);
                ctx.lineTo(dimensions.width, y);
            }
            ctx.stroke();

            const centerY = dimensions.height / 2;
            const speed = status === "thinking" ? 3 : 2;
            scanXRef.current = (scanXRef.current + speed) % dimensions.width;

            let amplitude = 0;
            if (status === "listening" || status === "speaking") {
                amplitude = volume * (dimensions.height * 0.4);
            } else if (status === "thinking") {
                amplitude = Math.sin(time * 0.01) * 20;
            } else {
                amplitude = (Math.random() - 0.5) * 4;
            }

            const newPoint = {
                x: scanXRef.current,
                y: centerY - amplitude,
                time: time
            };

            pointsRef.current.push(newPoint);
            if (pointsRef.current.length > 500) pointsRef.current.shift();

            ctx.shadowBlur = 15;
            ctx.shadowColor = status === "speaking" ? "#10b981" : "#3b82f6";
            ctx.strokeStyle = status === "speaking" ? "#10b981" : "#3b82f6";
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            let first = true;

            pointsRef.current.forEach((p, i) => {
                const age = time - p.time;
                const alpha = Math.max(0, 1 - age / 2000);

                const distToScan = Math.abs(p.x - scanXRef.current);
                if (distToScan > dimensions.width - 10) return;

                if (first) {
                    ctx.moveTo(p.x, p.y);
                    first = false;
                } else {
                    ctx.lineTo(p.x, p.y);
                }
            });
            ctx.stroke();

            ctx.shadowBlur = 20;
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.arc(newPoint.x, newPoint.y, 4, 0, Math.PI * 2);
            ctx.fill();

            animationId = requestAnimationFrame(draw);
        };

        animationId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animationId);
    }, [dimensions, status, volume]);

    return (
        <div className="relative w-full h-48 md:h-64 glass-premium overflow-hidden border border-primary/20 rounded-3xl group">
            <div className="absolute inset-0 bg-linear-to-b from-primary/5 to-transparent pointer-events-none" />
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                className="w-full h-full"
            />
            <div className="absolute top-4 left-6 flex items-center gap-3">
                <div className={cn(
                    "h-2 w-2 rounded-full animate-pulse",
                    status === "idle" ? "bg-muted" : "bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                )} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Vital Signs</span>
            </div>
            <div className="absolute bottom-4 right-6 text-[10px] font-mono opacity-30 uppercase tracking-widest">
                Sensor Active // {status}
            </div>
        </div>
    );
};

export default HeartbeatSensor;
