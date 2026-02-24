import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Port-to-service mapping
const PORT_SERVICES: Record<number, { name: string; probe: string }> = {
  21: { name: "FTP", probe: "" },
  22: { name: "SSH", probe: "" },
  25: { name: "SMTP", probe: "" },
  80: { name: "HTTP", probe: "GET / HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n" },
  110: { name: "POP3", probe: "" },
  143: { name: "IMAP", probe: "" },
  443: { name: "HTTPS", probe: "" },
  993: { name: "IMAPS", probe: "" },
  995: { name: "POP3S", probe: "" },
  3306: { name: "MySQL", probe: "" },
  3389: { name: "RDP", probe: "" },
  5432: { name: "PostgreSQL", probe: "" },
  6379: { name: "Redis", probe: "" },
  8080: { name: "HTTP-Proxy", probe: "GET / HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n" },
  8443: { name: "HTTPS-Alt", probe: "" },
  27017: { name: "MongoDB", probe: "" },
};

const SENSITIVE_PORTS = new Set([21, 22, 23, 25, 3306, 5432, 6379, 27017, 3389, 445, 1433]);
const DEFAULT_BANNERS = ["default", "admin", "root", "test", "welcome", "unauthorized"];

function computeRiskScore(port: number, banner: string): number {
  let score = 0;
  if (SENSITIVE_PORTS.has(port)) score += 40;
  const lowerBanner = (banner || "").toLowerCase();
  if (DEFAULT_BANNERS.some((d) => lowerBanner.includes(d))) score += 20;
  if ([3306, 5432, 27017, 6379].includes(port)) score += 25;
  if (lowerBanner.includes("version") || lowerBanner.includes("server:")) score += 15;
  return Math.min(score, 100);
}

// Validate IP: only public IPs
function isPublicIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  if (parts[0] === 10) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 127) return false;
  if (parts[0] === 0 || parts[0] >= 224) return false;
  return true;
}

// Expand IP range like "1.2.3.1-1.2.3.5" or single IP
function expandIPRange(input: string): string[] {
  const trimmed = input.trim();
  if (trimmed.includes("-")) {
    const [startIP, endPart] = trimmed.split("-");
    const startParts = startIP.trim().split(".").map(Number);
    let endParts: number[];
    if (endPart.trim().includes(".")) {
      endParts = endPart.trim().split(".").map(Number);
    } else {
      endParts = [...startParts];
      endParts[3] = Number(endPart.trim());
    }
    const start = (startParts[0] << 24) | (startParts[1] << 16) | (startParts[2] << 8) | startParts[3];
    const end = (endParts[0] << 24) | (endParts[1] << 16) | (endParts[2] << 8) | endParts[3];
    const ips: string[] = [];
    const maxIPs = 16; // limit for safety
    for (let i = start; i <= end && ips.length < maxIPs; i++) {
      ips.push(`${(i >>> 24) & 255}.${(i >>> 16) & 255}.${(i >>> 8) & 255}.${i & 255}`);
    }
    return ips;
  }
  return [trimmed];
}

async function scanPort(ip: string, port: number): Promise<{ open: boolean; banner: string }> {
  try {
    const conn = await Deno.connect({ hostname: ip, port, transport: "tcp" });
    let banner = "";
    try {
      const service = PORT_SERVICES[port];
      if (service?.probe) {
        const probe = new TextEncoder().encode(service.probe.replace("{host}", ip));
        await conn.write(probe);
      }
      const buf = new Uint8Array(1024);
      const readPromise = conn.read(buf);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      const n = await Promise.race([readPromise, timeoutPromise]);
      if (n && typeof n === "number") {
        banner = new TextDecoder().decode(buf.subarray(0, n)).trim();
      }
    } catch { /* banner grab failed, port still open */ }
    try { conn.close(); } catch { /* ignore */ }
    return { open: true, banner };
  } catch {
    return { open: false, banner: "" };
  }
}

async function geolocate(ip: string) {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,isp,org,as,lat,lon`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "success") return null;
    return {
      country: data.country || "",
      city: data.city || "",
      organization: data.org || data.isp || "",
      asn: data.as || "",
      latitude: data.lat,
      longitude: data.lon,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ip_range, ports } = await req.json();
    if (!ip_range || typeof ip_range !== "string") {
      return new Response(JSON.stringify({ error: "ip_range is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ips = expandIPRange(ip_range);
    const validIPs = ips.filter(isPublicIP);
    if (validIPs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid public IP addresses in range. Private/reserved IPs are not allowed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scanPorts: number[] = ports && Array.isArray(ports) ? ports : [21, 22, 80, 443, 3306, 8080];
    const sessionId = crypto.randomUUID();
    const steps: string[] = [];
    const results: Array<{
      ip: string; port: number; protocol: string; service: string;
      banner: string; risk_score: number; country?: string; city?: string;
      organization?: string; asn?: string; latitude?: number; longitude?: number;
    }> = [];

    steps.push(`[*] Scan session ${sessionId.slice(0, 8)} initialized`);
    steps.push(`[*] Target IPs: ${validIPs.join(", ")}`);
    steps.push(`[*] Ports: ${scanPorts.join(", ")}`);

    // Scan each IP
    for (const ip of validIPs) {
      steps.push(`[+] Scanning ${ip}...`);

      // Geo lookup in parallel with port scans
      const [geo, ...portResults] = await Promise.all([
        geolocate(ip),
        ...scanPorts.map((port) => scanPort(ip, port).then((r) => ({ port, ...r }))),
      ]);

      if (geo) {
        steps.push(`[✓] Geolocation: ${geo.country}, ${geo.city} (${geo.organization})`);
      }

      for (const pr of portResults) {
        if (pr.open) {
          const serviceName = PORT_SERVICES[pr.port]?.name || "Unknown";
          const risk = computeRiskScore(pr.port, pr.banner);
          steps.push(`[✓] ${ip}:${pr.port} OPEN — ${serviceName}${pr.banner ? ` | ${pr.banner.slice(0, 60)}` : ""} [Risk: ${risk}]`);
          results.push({
            ip,
            port: pr.port,
            protocol: "tcp",
            service: serviceName,
            banner: pr.banner.slice(0, 500),
            risk_score: risk,
            ...(geo || {}),
          });
        } else {
          steps.push(`[-] ${ip}:${pr.port} closed`);
        }
      }
    }

    steps.push(`[✓] Scan complete — ${results.length} open ports found across ${validIPs.length} hosts`);

    // Store results in database
    if (results.length > 0) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const rows = results.map((r) => ({ ...r, scan_session_id: sessionId }));
      const { error } = await supabase.from("scanned_hosts").insert(rows);
      if (error) {
        steps.push(`[!] Database storage error: ${error.message}`);
      } else {
        steps.push(`[✓] ${results.length} results indexed in database`);
      }
    }

    return new Response(
      JSON.stringify({ session_id: sessionId, steps, results, total_open: results.length, hosts_scanned: validIPs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
