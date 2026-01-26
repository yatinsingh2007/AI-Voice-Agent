import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "VoiceAI | Next-Gen Voice Assistant",
  description:
    "Production-ready, low-latency voice assistant with real-time web search and context awareness.",
};

import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <html lang="en" suppressHydrationWarning>
          <body
            className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased`}
          >
            {children}
          </body>
        </html>
      </ThemeProvider>
    </AuthProvider>
  );
}
