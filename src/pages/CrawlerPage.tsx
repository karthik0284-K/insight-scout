import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Globe, Play, Square, Download, Link2, ExternalLink, Server, ChevronDown } from "lucide-react";
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
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Globe className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">
            AI Web <span className="text-primary text-glow-green">Crawler</span>
          </h1>
        </div>
        <p className="text-muted-foreground font-mono text-sm">
          BFS-based intelligent web reconnaissance with depth control and rate limiting
        </p>
      </div>

      {/* Config Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-6 space-y-5"
      >
        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Target URL</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="font-mono bg-muted/50 border-border focus:border-primary"
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
                className="w-full h-10 rounded-md border border-border bg-muted/50 px-3 font-mono text-sm text-foreground appearance-none cursor-pointer focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>Depth {d}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
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
              className="font-mono bg-muted/50 border-border focus:border-primary"
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleStart}
            disabled={isRunning || !url.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2"
          >
            <Play className="w-4 h-4" /> Start Crawl
          </Button>
          {isRunning && (
            <Button
              onClick={handleStop}
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10 font-mono gap-2"
            >
              <Square className="w-4 h-4" /> Stop
            </Button>
          )}
          <Button
            onClick={() => setTerminalOpen(!terminalOpen)}
            variant="outline"
            className="font-mono gap-2 ml-auto border-border text-muted-foreground hover:text-foreground"
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
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-card p-4 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <span className="text-xs font-mono text-muted-foreground">{item.label}</span>
                </div>
                <p className={`text-2xl font-bold font-mono ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Link Tables */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="font-mono text-sm text-foreground">Internal Links</h3>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {result.internal_links.map((link, i) => (
                <div key={i} className="px-5 py-2 border-b border-border/50 font-mono text-xs text-muted-foreground hover:bg-muted/30 flex items-center gap-2">
                  <span className="text-primary/60">{i + 1}.</span> {link}
                </div>
              ))}
            </div>
          </div>

          {/* Download */}
          <Button
            onClick={() => generateCrawlPDF(result)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2"
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
