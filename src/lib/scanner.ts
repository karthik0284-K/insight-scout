import { LogEntry } from "@/components/TerminalLog";

export interface Vulnerability {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  evidence: string;
  recommendation: string;
}

export interface ReconIntel {
  ip_addresses?: string[];
  geolocation?: {
    country: string;
    region: string;
    city: string;
    isp: string;
    org: string;
    as_number: string;
    lat: number;
    lon: number;
  };
  ssl_certificate?: {
    issuer: string;
    subject: string;
    valid_from?: string;
    valid_to?: string;
    protocol?: string;
    serial_number?: string;
  };
  technologies?: string[];
  technical?: {
    http_status: number;
    content_type: string;
    content_length: string;
    response_time: string;
    redirected: boolean;
    final_url: string;
    protocol: string;
    internal_endpoints: number;
    external_domains: number;
  };
}

export interface ScanResult {
  target: string;
  scan_time: string;
  vulnerabilities_found: Vulnerability[];
  security_headers: Record<string, string>;
  risk_score: string;
  recon_intel?: ReconIntel;
}

type LogCallback = (log: Omit<LogEntry, "id">) => void;
const timestamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const runScan = async (
  url: string,
  onLog: LogCallback,
  abortSignal: AbortSignal
): Promise<ScanResult> => {
  const startTime = Date.now();
  const target = url.startsWith("http") ? url : `https://${url}`;

  onLog({ timestamp: timestamp(), message: `Initializing real vulnerability scan for ${target}`, type: "system" });
  onLog({ timestamp: timestamp(), message: "Performing non-destructive safety checks only", type: "system" });
  onLog({ timestamp: timestamp(), message: "Sending target to backend scanner...", type: "info" });

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/vulnerability-scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ url: target }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Unknown error" }));
      const errorMsg = err.error || `Server returned ${response.status}`;
      onLog({ timestamp: timestamp(), message: `Scan error: ${errorMsg}`, type: "error" });
      throw new Error(errorMsg);
    }

    const data = await response.json();

    // Replay steps as terminal logs
    if (data.steps && Array.isArray(data.steps)) {
      for (const step of data.steps) {
        if (abortSignal.aborted) break;
        const isWarning = step.startsWith("[!]");
        const isSuccess = step.startsWith("[✓]");
        onLog({
          timestamp: timestamp(),
          message: step,
          type: isWarning ? "warning" : isSuccess ? "success" : "info",
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    onLog({ timestamp: timestamp(), message: `Risk Score: ${data.risk_score}`, type: data.risk_score === "Low" ? "success" : "error" });
    onLog({ timestamp: timestamp(), message: `Scan completed in ${elapsed}s — ${data.vulnerabilities_found.length} vulnerabilities found`, type: "success" });

    return {
      target: data.target,
      scan_time: `${elapsed}s`,
      vulnerabilities_found: data.vulnerabilities_found,
      security_headers: data.security_headers,
      risk_score: data.risk_score,
      recon_intel: data.recon_intel,
    };
  } catch (err) {
    if (abortSignal.aborted) {
      onLog({ timestamp: timestamp(), message: "Scan aborted by user", type: "warning" });
      return {
        target,
        scan_time: "0s",
        vulnerabilities_found: [],
        security_headers: {},
        risk_score: "N/A",
      };
    }
    onLog({ timestamp: timestamp(), message: `Scan error: ${err instanceof Error ? err.message : "Unknown"}`, type: "error" });
    throw err;
  }
};
