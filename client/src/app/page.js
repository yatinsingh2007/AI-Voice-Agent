"use client";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";

export default function Home() {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <Hero />
      <Features />

      <section className="py-20 border-t border-border bg-background">
        <div className="container mx-auto px-6 text-center">
          <h2 className="mb-8 text-3xl font-bold text-foreground tracking-tight">
            Ready to experience the future?
          </h2>
          <div className="mx-auto h-1 w-20 bg-primary mb-8" />
          <p className="mb-10 text-muted-foreground max-w-xl mx-auto">
            Explore the observability dashboard or start a live voice session
            now.
          </p>
        </div>
      </section>
    </main>
  );
}
