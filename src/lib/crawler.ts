import { LogEntry } from "@/components/TerminalLog";

export interface CrawledPage {
  url: string;
  status: number;
  links_found: number;
  attack_surface: string[];
}

export interface CrawlResult {
  main_domain: string;
  pages_crawled: number;
  internal_links: string[];
  external_links: string[];
  subdomains: string[];
  crawled_pages: CrawledPage[];
  stopped_early: boolean;
  crawl_time: string;
}

type LogCallback = (log: Omit<LogEntry, "id">) => void;
const timestamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const runCrawl = async (
  url: string,
  depth: number,
  maxPages: number,
  onLog: LogCallback,
  abortSignal: AbortSignal
): Promise<CrawlResult> => {
  const startTime = Date.now();
  const target = url.startsWith("http") ? url : `https://${url}`;

  onLog({ timestamp: timestamp(), message: `Initializing real BFS crawler for ${target}`, type: "system" });
  onLog({ timestamp: timestamp(), message: `Config: depth=${depth}, max_pages=${maxPages}`, type: "system" });
  onLog({ timestamp: timestamp(), message: "Sending to backend crawler engine...", type: "info" });

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/web-crawler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ url: target, depth, maxPages }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error || `Server returned ${response.status}`);
    }

    const data = await response.json();

    // Replay steps as terminal logs
    if (data.steps && Array.isArray(data.steps)) {
      for (const step of data.steps) {
        if (abortSignal.aborted) break;
        const isWarning = step.startsWith("[!]");
        const isSuccess = step.startsWith("[✓]");
        const isSystem = step.startsWith("[*]");
        onLog({
          timestamp: timestamp(),
          message: step,
          type: isWarning ? "warning" : isSuccess ? "success" : isSystem ? "system" : "info",
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    onLog({ timestamp: timestamp(), message: `Crawl completed in ${elapsed}s — ${data.pages_crawled} pages crawled`, type: "success" });

    return {
      main_domain: data.main_domain,
      pages_crawled: data.pages_crawled,
      internal_links: data.internal_links || [],
      external_links: data.external_links || [],
      subdomains: data.subdomains || [],
      crawled_pages: data.crawled_pages || [],
      stopped_early: data.stopped_early || false,
      crawl_time: `${elapsed}s`,
    };
  } catch (err) {
    if (abortSignal.aborted) {
      onLog({ timestamp: timestamp(), message: "Crawl aborted by user", type: "warning" });
      return {
        main_domain: target,
        pages_crawled: 0,
        internal_links: [],
        external_links: [],
        subdomains: [],
        crawled_pages: [],
        stopped_early: true,
        crawl_time: "0s",
      };
    }
    onLog({ timestamp: timestamp(), message: `Crawl error: ${err instanceof Error ? err.message : "Unknown"}`, type: "error" });
    throw err;
  }
};
