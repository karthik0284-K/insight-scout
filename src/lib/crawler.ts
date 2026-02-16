import { LogEntry } from "@/components/TerminalLog";

export interface CrawlResult {
  main_domain: string;
  pages_crawled: number;
  internal_links: string[];
  external_links: string[];
  subdomains: string[];
  stopped_early: boolean;
  crawl_time: string;
}

type LogCallback = (log: Omit<LogEntry, "id">) => void;

const timestamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const generateFakePages = (domain: string, count: number): string[] => {
  const paths = [
    "/about", "/contact", "/blog", "/pricing", "/features", "/docs",
    "/api", "/login", "/signup", "/dashboard", "/settings", "/privacy",
    "/terms", "/faq", "/support", "/careers", "/team", "/products",
    "/services", "/portfolio", "/news", "/events", "/resources",
    "/help", "/status", "/changelog", "/integrations", "/partners",
  ];
  return paths.slice(0, count).map((p) => `${domain}${p}`);
};

const generateExternalLinks = (): string[] => [
  "https://cdn.jsdelivr.net/npm/bootstrap",
  "https://fonts.googleapis.com/css2",
  "https://www.google-analytics.com/analytics.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jquery",
  "https://unpkg.com/react@18",
];

const generateSubdomains = (domain: string): string[] => {
  const subs = ["api", "docs", "blog", "cdn", "mail", "admin"];
  const base = domain.replace(/^https?:\/\//, "").replace(/^www\./, "");
  return subs.slice(0, 3).map((s) => `https://${s}.${base}`);
};

export const runCrawl = async (
  url: string,
  depth: number,
  maxPages: number,
  onLog: LogCallback,
  abortSignal: AbortSignal
): Promise<CrawlResult> => {
  const startTime = Date.now();
  const domain = new URL(url.startsWith("http") ? url : `https://${url}`).origin;
  const pages = generateFakePages(domain, Math.min(maxPages, 28));

  onLog({ timestamp: timestamp(), message: `Initializing BFS crawler for ${domain}`, type: "system" });
  await delay(400);

  onLog({ timestamp: timestamp(), message: "Checking robots.txt...", type: "info" });
  await delay(600);
  onLog({ timestamp: timestamp(), message: "robots.txt parsed — no restrictions found", type: "success" });
  await delay(300);

  onLog({ timestamp: timestamp(), message: `Crawl config: depth=${depth}, max_pages=${maxPages}`, type: "system" });
  await delay(200);
  onLog({ timestamp: timestamp(), message: "Starting BFS traversal...", type: "info" });
  await delay(300);

  const crawled: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    if (abortSignal.aborted) {
      onLog({ timestamp: timestamp(), message: "Crawl stopped by user", type: "warning" });
      break;
    }

    const page = pages[i];
    onLog({ timestamp: timestamp(), message: `[${i + 1}/${pages.length}] Visiting: ${page}`, type: "info" });
    await delay(150 + Math.random() * 300);

    const linkCount = Math.floor(Math.random() * 15) + 3;
    onLog({ timestamp: timestamp(), message: `  → Extracted ${linkCount} links`, type: "success" });
    crawled.push(page);

    if (Math.random() > 0.7) {
      onLog({ timestamp: timestamp(), message: `  → Found external resource`, type: "info" });
    }

    await delay(100);

    if (i > 0 && (i + 1) % 5 === 0) {
      onLog({ timestamp: timestamp(), message: `Depth level ${Math.min(i / 5 + 1, depth)} complete`, type: "system" });
      if (Math.floor(i / 5 + 1) >= depth) {
        onLog({ timestamp: timestamp(), message: "Maximum depth reached", type: "warning" });
        break;
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const stoppedEarly = abortSignal.aborted;

  onLog({ timestamp: timestamp(), message: "Deduplicating results...", type: "info" });
  await delay(300);
  onLog({ timestamp: timestamp(), message: `Crawl ${stoppedEarly ? "stopped" : "completed"} in ${elapsed}s`, type: stoppedEarly ? "warning" : "success" });

  return {
    main_domain: domain,
    pages_crawled: crawled.length,
    internal_links: crawled,
    external_links: generateExternalLinks(),
    subdomains: generateSubdomains(domain),
    stopped_early: stoppedEarly,
    crawl_time: `${elapsed}s`,
  };
};
