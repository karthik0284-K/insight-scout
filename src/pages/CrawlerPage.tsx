import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Globe, Play, Square, Download, Link2, ExternalLink, Server, ChevronDown, ShieldAlert, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import TerminalLog, { LogEntry } from "@/components/TerminalLog";
import { runCrawl, CrawlResult } from "@/lib/crawler";
import { generateCrawlPDF } from "@/lib/pdf-generator";

const CrawlerPage = () => {
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(20);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((log: Omit<LogEntry, "id">) => {
    setLogs((prev) => [...prev, { ...log, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  const handleStart = async () => {
    if (!url.trim()) return;
    setIsRunning(true);
    setResult(null);
    setLogs([]);
    setTerminalOpen(true);
    setProgress(0);

    abortRef.current = new AbortController();

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 2, 95));
    }, 300);

    try {
      const res = await runCrawl(url, depth, maxPages, addLog, abortRef.current.signal);
      setResult(res);
      setProgress(100);
    } catch {
      addLog({ timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }), message: "Crawl failed", type: "error" });
    } finally {
      clearInterval(interval);
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <Link to="/" className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-3 h-3" /> Back to Home
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Globe className="w-8 h-8 text-primary" />
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            AI Web <span className="text-primary text-glow-green">Crawler</span>
          </h1>
        </div>
        <p className="text-muted-foreground font-mono text-sm">
          BFS-based intelligent web reconnaissance with depth control and rate limiting
        </p>
      </motion.div>

      {/* Config Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6 space-y-5 hover:border-primary/20 transition-colors duration-300"
      >
        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Target URL</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="font-mono bg-muted/50 border-border focus:border-primary h-11"
            disabled={isRunning}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-mono text-muted-foreground">Crawl Depth</label>
            <div className="relative">
              <select
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                disabled={isRunning}
                className="w-full h-11 rounded-md border border-border bg-muted/50 px-3 font-mono text-sm text-foreground appearance-none cursor-pointer focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>Depth {d}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-mono text-muted-foreground">Max Pages</label>
            <Input
              type="number"
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              min={1}
              max={100}
              className="font-mono bg-muted/50 border-border focus:border-primary h-11"
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleStart}
            disabled={isRunning || !url.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2 h-11 px-6"
          >
            <Play className="w-4 h-4" /> Start Crawl
          </Button>
          {isRunning && (
            <Button
              onClick={handleStop}
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10 font-mono gap-2 h-11"
            >
              <Square className="w-4 h-4" /> Stop
            </Button>
          )}
          <Button
            onClick={() => setTerminalOpen(!terminalOpen)}
            variant="outline"
            className="font-mono gap-2 ml-auto border-border text-muted-foreground hover:text-foreground h-11"
          >
            Terminal {logs.length > 0 && `(${logs.length})`}
          </Button>
        </div>

        {(isRunning || progress > 0) && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
              <span>{isRunning ? "Crawling..." : "Complete"}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-muted [&>div]:bg-primary" />
          </div>
        )}
      </motion.div>

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Pages Crawled", value: result.pages_crawled, icon: Globe, color: "text-primary" },
              { label: "Internal Links", value: result.internal_links.length, icon: Link2, color: "text-neon-cyan" },
              { label: "External Links", value: result.external_links.length, icon: ExternalLink, color: "text-neon-yellow" },
              { label: "Subdomains", value: result.subdomains.length, icon: Server, color: "text-neon-orange" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4 space-y-2 hover:border-primary/20 transition-all duration-300"
              >
                <div className="flex items-center gap-2">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <span className="text-xs font-mono text-muted-foreground">{item.label}</span>
                </div>
                <p className={`text-2xl font-bold font-mono ${item.color}`}>{item.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Crawled Pages with Attack Surface */}
          {result.crawled_pages && result.crawled_pages.length > 0 && (
            <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-neon-orange" />
                <h3 className="font-mono text-sm text-foreground">Crawled Pages & Attack Surface</h3>
              </div>
              <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
                {result.crawled_pages.map((page, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 hover:bg-muted/20 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-primary truncate max-w-[70%]">{page.url}</span>
                      <span className="text-xs font-mono text-muted-foreground">HTTP {page.status} · {page.links_found} links</span>
                    </div>
                    {page.attack_surface.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {page.attack_surface.map((attack, j) => (
                          <span key={j} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neon-orange/10 text-neon-orange border border-neon-orange/20">
                            {attack}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Internal Links */}
          <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="font-mono text-sm text-foreground">Internal Links ({result.internal_links.length})</h3>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {result.internal_links.map((link, i) => (
                <div key={i} className="px-5 py-2 border-b border-border/50 font-mono text-xs text-muted-foreground hover:bg-muted/30 flex items-center gap-2 transition-colors">
                  <span className="text-primary/60">{i + 1}.</span> {link}
                </div>
              ))}
            </div>
          </div>

          {/* Download */}
          <Button
            onClick={() => generateCrawlPDF(result)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2 h-11"
          >
            <Download className="w-4 h-4" /> Download PDF Report
          </Button>
        </motion.div>
      )}

      <TerminalLog logs={logs} title="Crawler Terminal" isOpen={terminalOpen} onClose={() => setTerminalOpen(false)} />
    </div>
  );
};

export default CrawlerPage;
