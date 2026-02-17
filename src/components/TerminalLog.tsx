import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minimize2, Maximize2, GripHorizontal, Move } from "lucide-react";

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
  const dragRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Reset position when opening
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
      setIsFullscreen(false);
      setIsMinimized(false);
    }
  }, [isOpen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [isFullscreen, position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: dragStart.current.posX + dx,
        y: dragStart.current.posY + dy,
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setPosition({ x: 0, y: 0 });
    }
    setIsFullscreen(!isFullscreen);
    setIsMinimized(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dragRef}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className={
            isFullscreen
              ? "fixed inset-0 z-50"
              : "fixed bottom-6 right-6 z-50 w-[640px] max-w-[calc(100vw-3rem)]"
          }
          style={
            isFullscreen
              ? undefined
              : { transform: `translate(${position.x}px, ${position.y}px)` }
          }
        >
          <div
            className={`flex flex-col border border-terminal-border bg-terminal-bg/95 backdrop-blur-xl shadow-2xl overflow-hidden border-glow-green ${
              isFullscreen ? "h-full rounded-none" : "rounded-xl max-h-[80vh]"
            }`}
          >
            {/* Title bar - draggable */}
            <div
              onMouseDown={handleMouseDown}
              className={`flex items-center justify-between px-4 py-2.5 border-b border-border/50 select-none shrink-0 ${
                isFullscreen
                  ? "bg-terminal-bg"
                  : "bg-muted/30 cursor-grab active:cursor-grabbing"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <button
                    onClick={onClose}
                    className="w-3 h-3 rounded-full bg-neon-red/80 hover:bg-neon-red transition-colors"
                    title="Close"
                  />
                  <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="w-3 h-3 rounded-full bg-neon-yellow/80 hover:bg-neon-yellow transition-colors"
                    title={isMinimized ? "Expand" : "Minimize"}
                  />
                  <button
                    onClick={toggleFullscreen}
                    className="w-3 h-3 rounded-full bg-primary/80 hover:bg-primary transition-colors"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  />
                </div>
                {!isFullscreen && (
                  <Move className="w-3.5 h-3.5 text-muted-foreground/40" />
                )}
                <span className="text-xs font-mono text-muted-foreground">
                  {title} — {logs.length} entries
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 hover:bg-muted/50 rounded transition-colors text-muted-foreground hover:text-foreground"
                  title={isMinimized ? "Expand" : "Minimize"}
                >
                  {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-1 hover:bg-muted/50 rounded transition-colors text-muted-foreground hover:text-foreground"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-destructive/20 rounded transition-colors text-muted-foreground hover:text-destructive"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Log content */}
            {!isMinimized && (
              <div
                ref={scrollRef}
                className={`overflow-y-auto p-4 font-mono text-xs leading-relaxed terminal-scroll flex-1 ${
                  isFullscreen ? "" : "h-72"
                }`}
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
                      transition={{ delay: Math.min(i * 0.01, 0.5) }}
                      className={`${typeStyles[log.type]} py-0.5 hover:bg-muted/10 px-1 rounded`}
                    >
                      <span className="text-muted-foreground/50 mr-2">{log.timestamp}</span>
                      <span className="font-semibold mr-1">{typePrefix[log.type]}</span>
                      {log.message}
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {/* Status bar */}
            {!isMinimized && (
              <div className="px-4 py-1.5 border-t border-border/30 bg-terminal-bg flex items-center justify-between text-[10px] font-mono text-muted-foreground/50 shrink-0">
                <span>
                  {logs.filter(l => l.type === "error").length} errors · {logs.filter(l => l.type === "warning").length} warnings
                </span>
                <span>{isFullscreen ? "ESC to exit" : "Drag to move"}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TerminalLog;
