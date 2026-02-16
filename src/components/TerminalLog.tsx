import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minimize2, Maximize2 } from "lucide-react";
import { useState } from "react";

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "system";
}

interface TerminalLogProps {
  logs: LogEntry[];
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

const typeStyles: Record<LogEntry["type"], string> = {
  info: "text-terminal-text",
  success: "text-primary",
  warning: "text-neon-yellow",
  error: "text-neon-red",
  system: "text-neon-cyan",
};

const typePrefix: Record<LogEntry["type"], string> = {
  info: "[+]",
  success: "[✓]",
  warning: "[!]",
  error: "[✗]",
  system: "[*]",
};

const TerminalLog = ({ logs, title = "Terminal", isOpen, onClose }: TerminalLogProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 w-[600px] max-w-[calc(100vw-3rem)]"
        >
          <div className="rounded-lg border border-terminal-border bg-terminal-bg/95 backdrop-blur-xl shadow-2xl overflow-hidden border-glow-green">
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neon-red/80" />
                  <div className="w-3 h-3 rounded-full bg-neon-yellow/80" />
                  <div className="w-3 h-3 rounded-full bg-primary/80" />
                </div>
                <span className="text-xs font-mono text-muted-foreground ml-2">
                  {title} — {logs.length} entries
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 hover:bg-muted/50 rounded transition-colors text-muted-foreground hover:text-foreground"
                >
                  {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-destructive/20 rounded transition-colors text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Log content */}
            {!isMinimized && (
              <div
                ref={scrollRef}
                className="h-72 overflow-y-auto p-4 font-mono text-xs leading-relaxed terminal-scroll"
              >
                {logs.length === 0 ? (
                  <div className="text-muted-foreground cursor-blink">
                    Awaiting input...
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.01 }}
                      className={`${typeStyles[log.type]} py-0.5`}
                    >
                      <span className="text-muted-foreground/60">{log.timestamp}</span>{" "}
                      <span className="font-semibold">{typePrefix[log.type]}</span>{" "}
                      {log.message}
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TerminalLog;
