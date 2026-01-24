"use client";

import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
        >
            {theme === "dark" ? (
                <Sun className="h-5 w-5 transition-all text-yellow-500" />
            ) : (
                <Moon className="h-5 w-5 transition-all text-blue-600" />
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
