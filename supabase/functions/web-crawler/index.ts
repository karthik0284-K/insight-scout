import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CrawledPage {
  url: string;
  status: number;
  links_found: number;
  attack_surface: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url, depth, maxPages } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = url.startsWith("http") ? url : `https://${url}`;
    const baseOrigin = new URL(target).origin;
    const steps: string[] = [];
    const visited = new Set<string>();
    const queue: { url: string; currentDepth: number }[] = [{ url: target, currentDepth: 0 }];
    const internalLinks = new Set<string>();
    const externalLinks = new Set<string>();
    const subdomains = new Set<string>();
    const crawledPages: CrawledPage[] = [];
    const maxDepth = depth || 3;
    const limit = maxPages || 20;

    steps.push(`[*] Initializing BFS crawler for ${baseOrigin}`);
    steps.push(`[*] Config: depth=${maxDepth}, max_pages=${limit}`);

    // Check robots.txt
    steps.push(`[+] Fetching robots.txt...`);
    try {
      const robotsResp = await fetch(`${baseOrigin}/robots.txt`, {
        headers: { "User-Agent": "LovableWebCrawler/2.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (robotsResp.ok) {
        const robotsTxt = await robotsResp.text();
        const disallowed = (robotsTxt.match(/Disallow:\s*(.+)/gi) || []).length;
        steps.push(`[✓] robots.txt found — ${disallowed} disallow rules`);
      } else {
        steps.push(`[✓] No robots.txt found — no restrictions`);
      }
    } catch {
      steps.push(`[+] Could not fetch robots.txt`);
    }

    steps.push(`[+] Starting BFS traversal...`);

    while (queue.length > 0 && visited.size < limit) {
      const item = queue.shift()!;
      if (visited.has(item.url) || item.currentDepth > maxDepth) continue;
      visited.add(item.url);

      steps.push(`[+] [${visited.size}/${limit}] Visiting: ${item.url.substring(0, 100)}`);

      try {
        const resp = await fetch(item.url, {
          method: "GET",
          headers: { "User-Agent": "LovableWebCrawler/2.0" },
          signal: AbortSignal.timeout(10000),
          redirect: "follow",
        });

        const contentType = resp.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) {
          steps.push(`[+]   → Skipping non-HTML content: ${contentType.split(";")[0]}`);
          continue;
        }

        const pageBody = await resp.text();
        const attackSurface: string[] = [];

        // Extract all links
        const linkRegex = /(?:href|src|action)\s*=\s*["']([^"'#]+)["']/gi;
        let match;
        const pageLinks: string[] = [];

        while ((match = linkRegex.exec(pageBody)) !== null) {
          try {
            const resolved = new URL(match[1], item.url);
            const cleanUrl = resolved.origin + resolved.pathname;

            if (resolved.origin === baseOrigin) {
              internalLinks.add(cleanUrl);
              pageLinks.push(cleanUrl);
              if (!visited.has(cleanUrl) && item.currentDepth + 1 <= maxDepth) {
                queue.push({ url: cleanUrl, currentDepth: item.currentDepth + 1 });
              }
            } else if (resolved.protocol.startsWith("http")) {
              externalLinks.add(resolved.href);
              // Check for subdomains
              const baseDomain = new URL(baseOrigin).hostname.replace(/^www\./, "");
              if (resolved.hostname.endsWith(baseDomain) && resolved.hostname !== new URL(baseOrigin).hostname) {
                subdomains.add(resolved.origin);
                steps.push(`[+]   → Subdomain discovered: ${resolved.hostname}`);
              }
            }
          } catch {
            // invalid URL, skip
          }
        }

        // Analyze attack surface for this page
        // Forms = potential injection points
        const forms = (pageBody.match(/<form[^>]*>/gi) || []);
        if (forms.length > 0) {
          attackSurface.push(`${forms.length} form(s) — potential injection target`);
          steps.push(`[+]   → ${forms.length} form(s) found (potential SQLi/XSS target)`);
        }

        // Input fields
        const inputs = (pageBody.match(/<input[^>]*>/gi) || []);
        const textInputs = inputs.filter((i) => /type\s*=\s*["']?(text|search|email|password|url|tel)/i.test(i) || !/type\s*=/i.test(i));
        if (textInputs.length > 0) {
          attackSurface.push(`${textInputs.length} text input(s) — XSS/injection vector`);
        }

        // File upload
        const fileInputs = inputs.filter((i) => /type\s*=\s*["']?file/i.test(i));
        if (fileInputs.length > 0) {
          attackSurface.push(`File upload detected — potential RCE/upload bypass`);
          steps.push(`[!]   → File upload found — potential attack vector`);
        }

        // Query parameters
        const hasParams = /\?[^"']+=[^"']+/.test(item.url);
        if (hasParams) {
          attackSurface.push(`URL has query parameters — SQLi/XSS testing target`);
        }

        // Login/auth pages
        if (/login|signin|auth|password/i.test(item.url) || /type\s*=\s*["']?password/i.test(pageBody)) {
          attackSurface.push(`Authentication page — brute force/credential stuffing target`);
          steps.push(`[+]   → Authentication page detected`);
        }

        // API endpoints
        if (/\/api\//i.test(item.url) || /application\/json/i.test(contentType)) {
          attackSurface.push(`API endpoint — test for auth bypass and IDOR`);
          steps.push(`[+]   → API endpoint detected`);
        }

        // Comments with sensitive info
        const comments = pageBody.match(/<!--[\s\S]*?-->/g) || [];
        const sensitiveComments = comments.filter((c) => /password|secret|key|token|todo|fixme|hack|bug/i.test(c));
        if (sensitiveComments.length > 0) {
          attackSurface.push(`${sensitiveComments.length} HTML comment(s) with sensitive keywords`);
          steps.push(`[!]   → Sensitive HTML comments found`);
        }

        steps.push(`[✓]   → Extracted ${pageLinks.length} links, ${attackSurface.length} attack vectors`);

        crawledPages.push({
          url: item.url,
          status: resp.status,
          links_found: pageLinks.length,
          attack_surface: attackSurface,
        });

        // Depth tracking
        if (item.currentDepth > 0 && visited.size % 5 === 0) {
          steps.push(`[*] Progress: ${visited.size} pages crawled, depth level ${item.currentDepth}`);
        }
      } catch (err) {
        steps.push(`[!] Error fetching ${item.url.substring(0, 80)}: ${err instanceof Error ? err.message : "timeout"}`);
      }
    }

    const stoppedEarly = queue.length > 0 && visited.size >= limit;
    if (stoppedEarly) {
      steps.push(`[!] Page limit reached (${limit}), ${queue.length} URLs still in queue`);
    }

    steps.push(`\n[*] === Crawl Complete ===`);
    steps.push(`[+] Pages crawled: ${crawledPages.length}`);
    steps.push(`[+] Internal links: ${internalLinks.size}`);
    steps.push(`[+] External links: ${externalLinks.size}`);
    steps.push(`[+] Subdomains: ${subdomains.size}`);
    steps.push(`[✓] Crawler shutdown`);

    return new Response(
      JSON.stringify({
        main_domain: baseOrigin,
        pages_crawled: crawledPages.length,
        internal_links: Array.from(internalLinks),
        external_links: Array.from(externalLinks),
        subdomains: Array.from(subdomains),
        crawled_pages: crawledPages,
        stopped_early: stoppedEarly,
        steps,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
