import { cn } from "@/lib/utils";

type Severity = "low" | "medium" | "high" | "critical" | "info";

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

const severityConfig: Record<Severity, { label: string; className: string }> = {
  info: {
    label: "Info",
    className: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
  },
  low: {
    label: "Low",
    className: "bg-severity-low/10 text-severity-low border-severity-low/30",
  },
  medium: {
    label: "Medium",
    className: "bg-severity-medium/10 text-severity-medium border-severity-medium/30",
  },
  high: {
    label: "High",
    className: "bg-severity-high/10 text-severity-high border-severity-high/30",
  },
  critical: {
    label: "Critical",
    className: "bg-severity-critical/10 text-severity-critical border-severity-critical/30",
  },
};

const SeverityBadge = ({ severity, className }: SeverityBadgeProps) => {
  const config = severityConfig[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};

export default SeverityBadge;
