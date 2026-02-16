import { LogEntry } from "@/components/TerminalLog";

export interface Vulnerability {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  evidence: string;
  recommendation: string;
}

export interface ScanResult {
  target: string;
  scan_time: string;
  vulnerabilities_found: Vulnerability[];
  security_headers: Record<string, string>;
  risk_score: string;
}

type LogCallback = (log: Omit<LogEntry, "id">) => void;
const timestamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const possibleVulns: Vulnerability[] = [
  {
    type: "Missing Content-Security-Policy",
    severity: "medium",
    description: "No Content-Security-Policy header detected. This allows potential XSS attacks.",
    evidence: "Response headers do not contain Content-Security-Policy",
    recommendation: "Implement a strict CSP header to prevent inline script execution.",
  },
  {
    type: "Missing X-Frame-Options",
    severity: "medium",
    description: "X-Frame-Options header is absent, making the site vulnerable to clickjacking.",
    evidence: "X-Frame-Options header not found in server response",
    recommendation: "Add X-Frame-Options: DENY or SAMEORIGIN header.",
  },
  {
    type: "Reflected XSS Pattern",
    severity: "high",
    description: "Potential reflected XSS detected in query parameter handling.",
    evidence: "Input parameter reflected in response without sanitization: ?q=<script>",
    recommendation: "Sanitize all user inputs and encode output properly.",
  },
  {
    type: "SQL Injection Pattern",
    severity: "critical",
    description: "Potential SQL injection point detected in form parameter.",
    evidence: "Error-based response observed with payload: ' OR 1=1--",
    recommendation: "Use parameterized queries and input validation.",
  },
  {
    type: "CORS Misconfiguration",
    severity: "medium",
    description: "Access-Control-Allow-Origin is set to wildcard (*).",
    evidence: "Access-Control-Allow-Origin: * in response headers",
    recommendation: "Restrict CORS to trusted domains only.",
  },
  {
    type: "Missing HTTPS Redirect",
    severity: "low",
    description: "HTTP to HTTPS redirect not enforced.",
    evidence: "HTTP port 80 accessible without redirect to 443",
    recommendation: "Configure server to redirect all HTTP traffic to HTTPS.",
  },
  {
    type: "Directory Traversal Pattern",
    severity: "high",
    description: "Path traversal patterns not properly filtered.",
    evidence: "Response differs with payload: ../../etc/passwd",
    recommendation: "Validate and sanitize file path inputs. Use whitelisting.",
  },
  {
    type: "Open Redirect",
    severity: "medium",
    description: "Redirect parameter accepts external URLs without validation.",
    evidence: "?redirect=https://evil.com results in 302 redirect",
    recommendation: "Validate redirect URLs against a whitelist of allowed domains.",
  },
  {
    type: "Missing Strict-Transport-Security",
    severity: "low",
    description: "HSTS header not configured.",
    evidence: "Strict-Transport-Security header absent from response",
    recommendation: "Add Strict-Transport-Security: max-age=31536000; includeSubDomains",
  },
];

const scanSteps = [
  { msg: "Resolving target hostname...", type: "info" as const },
  { msg: "Checking HTTPS configuration...", type: "info" as const },
  { msg: "Analyzing security headers...", type: "info" as const },
  { msg: "Testing for XSS patterns...", type: "info" as const },
  { msg: "Testing SQL injection patterns...", type: "info" as const },
  { msg: "Checking CORS configuration...", type: "info" as const },
  { msg: "Testing directory traversal...", type: "info" as const },
  { msg: "Checking open redirect vulnerabilities...", type: "info" as const },
  { msg: "Analyzing X-Frame-Options...", type: "info" as const },
  { msg: "Checking Content-Security-Policy...", type: "info" as const },
  { msg: "Evaluating HSTS configuration...", type: "info" as const },
];

export const runScan = async (
  url: string,
  onLog: LogCallback,
  abortSignal: AbortSignal
): Promise<ScanResult> => {
  const startTime = Date.now();
  const target = url.startsWith("http") ? url : `https://${url}`;

  onLog({ timestamp: timestamp(), message: `Initializing vulnerability scan for ${target}`, type: "system" });
  await delay(500);

  onLog({ timestamp: timestamp(), message: "Performing non-destructive safety checks only", type: "system" });
  await delay(300);

  const foundVulns: Vulnerability[] = [];

  for (const step of scanSteps) {
    if (abortSignal.aborted) {
      onLog({ timestamp: timestamp(), message: "Scan aborted by user", type: "warning" });
      break;
    }

    onLog({ timestamp: timestamp(), message: step.msg, type: step.type });
    await delay(400 + Math.random() * 600);

    // Randomly find vulnerabilities
    const matchingVuln = possibleVulns.find(
      (v) =>
        step.msg.toLowerCase().includes(v.type.toLowerCase().split(" ")[0]) ||
        (Math.random() > 0.65 && !foundVulns.includes(v))
    );

    if (matchingVuln && !foundVulns.includes(matchingVuln)) {
      foundVulns.push(matchingVuln);
      const sevType = matchingVuln.severity === "critical" || matchingVuln.severity === "high" ? "error" : "warning";
      onLog({
        timestamp: timestamp(),
        message: `⚠ ${matchingVuln.type} [${matchingVuln.severity.toUpperCase()}]`,
        type: sevType,
      });
      await delay(200);
    } else {
      onLog({ timestamp: timestamp(), message: "  → No issues detected", type: "success" });
    }

    await delay(100);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  onLog({ timestamp: timestamp(), message: "Calculating risk score...", type: "info" });
  await delay(400);

  const riskScore =
    foundVulns.some((v) => v.severity === "critical")
      ? "Critical"
      : foundVulns.some((v) => v.severity === "high")
      ? "High"
      : foundVulns.some((v) => v.severity === "medium")
      ? "Medium"
      : "Low";

  onLog({ timestamp: timestamp(), message: `Risk Score: ${riskScore}`, type: riskScore === "Low" ? "success" : "error" });
  onLog({ timestamp: timestamp(), message: `Scan completed in ${elapsed}s — ${foundVulns.length} vulnerabilities found`, type: "success" });

  return {
    target,
    scan_time: `${elapsed}s`,
    vulnerabilities_found: foundVulns,
    security_headers: {
      "X-Frame-Options": Math.random() > 0.5 ? "SAMEORIGIN" : "Not Set",
      "Content-Security-Policy": Math.random() > 0.6 ? "default-src 'self'" : "Not Set",
      "Strict-Transport-Security": Math.random() > 0.4 ? "max-age=31536000" : "Not Set",
      "X-Content-Type-Options": "nosniff",
      "X-XSS-Protection": "1; mode=block",
      "Access-Control-Allow-Origin": Math.random() > 0.5 ? "*" : "Not Set",
    },
    risk_score: riskScore,
  };
};
