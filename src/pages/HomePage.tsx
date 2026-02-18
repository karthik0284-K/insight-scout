import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, Globe, Bug, Zap, ArrowRight, Lock, Radar, Terminal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import CyberShield3D from "@/components/CyberShield3D";

const BootSequence = ({ onComplete }: { onComplete: () => void }) => {
  const [lines, setLines] = useState<string[]>([]);
  const bootLines = [
    "[*] Initializing AI Recon Engine v3.0...",
    "[*] Loading neural threat detection modules...",
    "[✓] Core systems online",
    "[*] Establishing secure connection...",
    "[✓] Encryption protocols active",
    "[*] Calibrating vulnerability scanners...",
    "[✓] Scanner array ready",
    "[*] Activating web crawler subsystem...",
    "[✓] BFS crawler initialized",
    "[✓] All systems operational — Welcome, Operator.",
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < bootLines.length) {
        setLines((prev) => [...prev, bootLines[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 600);
      }
    }, 180);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-background flex items-center justify-center"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="w-full max-w-xl px-6">
        <div className="rounded-xl border border-terminal-border bg-terminal-bg/95 p-6 backdrop-blur-xl border-glow-green">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-neon-red/80" />
            <div className="w-3 h-3 rounded-full bg-neon-yellow/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="text-xs font-mono text-muted-foreground ml-2">boot_sequence.sh</span>
          </div>
          <div className="font-mono text-xs space-y-1">
            {lines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={
                  line.includes("[✓]")
                    ? "text-primary"
                    : line.includes("[!]")
                    ? "text-neon-yellow"
                    : "text-neon-cyan"
                }
              >
                {line}
              </motion.div>
            ))}
            {lines.length < bootLines.length && (
              <span className="text-primary cursor-blink" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const StatCard = ({ icon: Icon, label, value, delay }: { icon: any; label: string; value: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 hover:border-primary/30 hover:border-glow-green transition-all duration-300 group"
  >
    <Icon className="w-5 h-5 text-primary mb-3 group-hover:text-glow-green transition-all" />
    <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
    <p className="text-xs font-mono text-muted-foreground mt-1">{label}</p>
  </motion.div>
);

const FeatureCard = ({ icon: Icon, title, desc, color, delay }: { icon: any; title: string; desc: string; color: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.6 }}
    className="rounded-xl border border-border bg-card/30 backdrop-blur-sm p-6 hover:bg-card/60 transition-all duration-300 group"
  >
    <div className={`w-10 h-10 rounded-lg bg-${color}/10 flex items-center justify-center mb-4`}>
      <Icon className={`w-5 h-5 text-${color}`} />
    </div>
    <h3 className="font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
  </motion.div>
);

const HomePage = () => {
  const [booted, setBooted] = useState(false);
  const [showBoot, setShowBoot] = useState(true);

  useEffect(() => {
    const seen = sessionStorage.getItem("ai-recon-booted");
    if (seen) {
      setShowBoot(false);
      setBooted(true);
    }
  }, []);

  const handleBootComplete = () => {
    sessionStorage.setItem("ai-recon-booted", "1");
    setBooted(true);
    setTimeout(() => setShowBoot(false), 800);
  };

  return (
    <>
      <AnimatePresence>
        {showBoot && !booted && <BootSequence onComplete={handleBootComplete} />}
      </AnimatePresence>

      {booted && (
        <div className="space-y-24">
          {/* Hero Section */}
          <section className="relative min-h-[85vh] flex items-center -mt-8">
            {/* 3D Background */}
            <div className="absolute right-0 top-0 w-1/2 h-full opacity-80 hidden lg:block">
              <Suspense fallback={null}>
                <CyberShield3D />
              </Suspense>
            </div>

            {/* Radial gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none" />

            <div className="relative z-10 max-w-2xl space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 mb-6">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-mono text-primary">SYSTEM ACTIVE</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight">
                  <span className="text-foreground">AI-Powered</span>
                  <br />
                  <span className="text-primary text-glow-green">Cyber Recon</span>
                  <br />
                  <span className="text-foreground">Platform</span>
                </h1>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="text-lg text-muted-foreground max-w-lg leading-relaxed"
              >
                Advanced web intelligence suite featuring real-time vulnerability scanning,
                intelligent web crawling, and zero-day heuristic detection powered by AI.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
                className="flex flex-wrap gap-4"
              >
                <Link to="/vulnerability">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2 h-12 px-8 text-base">
                    <Bug className="w-5 h-5" /> Launch Scanner
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/">
                  <Button size="lg" variant="outline" className="border-border hover:border-primary/50 font-mono gap-2 h-12 px-8 text-base hover:bg-primary/5">
                    <Globe className="w-5 h-5" /> Start Crawling
                  </Button>
                </Link>
              </motion.div>
            </div>

            {/* Scroll indicator */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2"
            >
              <ChevronDown className="w-6 h-6 text-muted-foreground/40" />
            </motion.div>
          </section>

          {/* Stats */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Shield} label="Security Checks" value="14+" delay={0} />
            <StatCard icon={Radar} label="Detection Methods" value="6" delay={0.1} />
            <StatCard icon={Zap} label="Zero-Day Heuristics" value="Active" delay={0.2} />
            <StatCard icon={Lock} label="Encryption" value="E2E" delay={0.3} />
          </section>

          {/* Features */}
          <section className="space-y-12">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center space-y-3"
            >
              <h2 className="text-3xl font-bold text-foreground">
                Intelligence <span className="text-primary text-glow-green">Suite</span>
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto font-mono text-sm">
                Comprehensive security analysis and web reconnaissance tools
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              <FeatureCard
                icon={Bug}
                title="Vulnerability Scanner"
                desc="14-phase security analysis with SQL injection, XSS, directory traversal, and zero-day anomaly detection."
                color="neon-cyan"
                delay={0}
              />
              <FeatureCard
                icon={Globe}
                title="Web Crawler"
                desc="BFS-based intelligent crawler that maps entire site architectures and identifies attack surfaces per page."
                color="primary"
                delay={0.1}
              />
              <FeatureCard
                icon={Terminal}
                title="Live Terminal"
                desc="Real-time terminal output showing every backend test phase. Draggable, fullscreen, and fully interactive."
                color="neon-yellow"
                delay={0.2}
              />
            </div>
          </section>

          {/* CTA */}
          <section className="relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card/50 to-neon-cyan/5 p-12 text-center space-y-6 border-glow-green"
            >
              <Shield className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-3xl font-bold text-foreground">
                Ready to <span className="text-primary text-glow-green">Scan</span>?
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Start your first security assessment now. Non-destructive, passive, and AI-enhanced.
              </p>
              <Link to="/vulnerability">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2 h-12 px-10 text-base">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </section>

          {/* Footer */}
          <footer className="border-t border-border/30 pt-8 pb-4 text-center">
            <p className="text-xs font-mono text-muted-foreground/50">
              AI Recon v3.0 · Built for ethical security research · All scans are non-destructive
            </p>
          </footer>
        </div>
      )}
    </>
  );
};

export default HomePage;
