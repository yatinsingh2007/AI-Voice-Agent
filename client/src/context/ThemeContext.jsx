"use client";

import { createContext, useContext, useEffect, useState } from "react";

export const ThemeContext = createContext({
    theme: "dark",
    toggleTheme: () => { },
});

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("theme");
            if (stored) return stored;

            if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                return "dark";
            }
            return "light";
        }
        return "dark";
    });

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const root = document.documentElement;

        // Update DOM when theme changes
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }

        // Persist to localStorage
        localStorage.setItem("theme", theme);
    }, [theme, mounted]);

    const toggleTheme = () => {
        setTheme(prev => prev === "dark" ? "light" : "dark");
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);