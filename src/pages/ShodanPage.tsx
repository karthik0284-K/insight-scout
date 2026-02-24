import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Radar, Shield, Globe, Server, AlertTriangle, Activity,
  Play, Square, Download, ChevronDown, Terminal, Wifi, Database,
  MapPin, Hash, Clock, Filter, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ScanResult {
  ip: string;
  port: number;
  protocol: string;
  service: string;
  banner: string;
  risk_score: number;
  country?: string;
  city?: string;
  organization?: string;
  asn?: string;
}

interface HostRecord {
  id: string;
  ip: string;
  port: number;
  protocol: string;
  service: string | null;
  banner: string | null;
  country: string | null;
  city: string | null;
  organization: string | null;
  asn: string | null;
  risk_score: number;
  created_at: string;
  scan_session_id: string | null;
}

const COMMON_PORTS = [
  { port: 21, label: "FTP" },
  { port: 22, label: "SSH" },
  { port: 80, label: "HTTP" },
  { port: 443, label: "HTTPS" },
  { port: 3306, label: "MySQL" },
  { port: 8080, label: "HTTP-Proxy" },
];

const ShodanPage = () => {
  const [ipRange, setIpRange] = useState("");
  const [selectedPorts, setSelectedPorts] = useState<number[]>([21, 22, 80, 443, 3306, 8080]);
  const [scanning, setScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [liveResults, setLiveResults] = useState<ScanResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [indexedHosts, setIndexedHosts] = useState<HostRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, highRisk: 0, countries: 0, services: 0 });
  const [filterCountry, setFilterCountry] = useState("");
  const [filterPort, setFilterPort] = useState("");
  const [filterService, setFilterService] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load indexed hosts
  useEffect(() => {
    loadIndexedHosts();
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [scanLogs]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("scanned_hosts_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scanned_hosts" }, (payload) => {
        setIndexedHosts((prev) => [payload.new as HostRecord, ...prev]);
        updateStats((prev) => [payload.new as HostRecord, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateStats = (hostsFn: (prev: HostRecord[]) => HostRecord[]) => {
    setIndexedHosts((prev) => {
      const hosts = hostsFn(prev);
      const countries = new Set(hosts.map((h) => h.country).filter(Boolean));
      const services = new Set(hosts.map((h) => h.service).filter(Boolean));
      setStats({
        total: hosts.length,
        highRisk: hosts.filter((h) => h.risk_score >= 60).length,
        countries: countries.size,
        services: services.size,
      });
      return hosts;
    });
  };

  const loadIndexedHosts = async () => {
    const { data, error } = await supabase
      .from("scanned_hosts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) {
      setIndexedHosts(data as HostRecord[]);
      const countries = new Set(data.map((h: any) => h.country).filter(Boolean));
      const services = new Set(data.map((h: any) => h.service).filter(Boolean));
      setStats({
        total: data.length,
        highRisk: data.filter((h: any) => h.risk_score >= 60).length,
        countries: countries.size,
        services: services.size,
      });
    }
  };

  const startScan = async () => {
    if (!ipRange.trim()) {
      toast({ title: "Error", description: "Enter an IP address or range", variant: "destructive" });
      return;
    }
    setScanning(true);
    setScanLogs(["[*] Initiating port scan..."]);
    setLiveResults([]);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/port-scanner`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ ip_range: ipRange, ports: selectedPorts }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        setScanLogs((prev) => [...prev, `[!] Error: ${data.error}`]);
        toast({ title: "Scan Failed", description: data.error, variant: "destructive" });
      } else {
        if (data.steps) setScanLogs(data.steps);
        if (data.results) setLiveResults(data.results);
        toast({ title: "Scan Complete", description: `${data.total_open} open ports found` });
        loadIndexedHosts();
      }
    } catch (err) {
      setScanLogs((prev) => [...prev, `[!] ${err instanceof Error ? err.message : "Network error"}`]);
    } finally {
      setScanning(false);
    }
  };

  const togglePort = (port: number) => {
    setSelectedPorts((prev) =>
      prev.includes(port) ? prev.filter((p) => p !== port) : [...prev, port]
    );
  };

  // Filter hosts
  const filteredHosts = indexedHosts.filter((h) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        h.ip.includes(q) ||
        (h.service || "").toLowerCase().includes(q) ||
        (h.banner || "").toLowerCase().includes(q) ||
        (h.country || "").toLowerCase().includes(q) ||
        (h.organization || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterCountry && h.country !== filterCountry) return false;
    if (filterPort && h.port !== Number(filterPort)) return false;
    if (filterService && h.service !== filterService) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = "IP,Port,Service,Banner,Country,City,Organization,Risk Score,Timestamp\n";
    const rows = filteredHosts
      .map((h) =>
        `"${h.ip}",${h.port},"${h.service || ""}","${(h.banner || "").replace(/"/g, '""')}","${h.country || ""}","${h.city || ""}","${h.organization || ""}",${h.risk_score},"${h.created_at}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shodan-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const riskColor = (score: number) => {
    if (score >= 75) return "text-red-400";
    if (score >= 50) return "text-orange-400";
    if (score >= 25) return "text-yellow-400";
    return "text-emerald-400";
  };

  const riskBg = (score: number) => {
    if (score >= 75) return "bg-red-500/20 text-red-400 border-red-500/30";
    if (score >= 50) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (score >= 25) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  };

  const uniqueCountries = [...new Set(indexedHosts.map((h) => h.country).filter(Boolean))];
  const uniqueServices = [...new Set(indexedHosts.map((h) => h.service).filter(Boolean))];
  const uniquePorts = [...new Set(indexedHosts.map((h) => h.port))].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono text-foreground flex items-center gap-3">
            <Radar className="w-8 h-8 text-primary animate-pulse-glow" />
            Net<span className="text-primary text-glow-green">Recon</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono">
            Distributed Internet Scanner — Educational Use Only
          </p>
        </div>
        <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 font-mono text-xs px-3 py-1">
          <AlertTriangle className="w-3 h-3 mr-1" />
          ETHICAL USE ONLY
        </Badge>
      </div>

      {/* Disclaimer */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-300/80 font-mono leading-relaxed">
            This tool is for authorized security research and educational purposes only.
            Only scan IP addresses you own or have explicit permission to test.
            Unauthorized scanning may violate laws. Use responsibly.
          </p>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Server, label: "Indexed Hosts", value: stats.total, color: "text-primary" },
          { icon: AlertTriangle, label: "High Risk", value: stats.highRisk, color: "text-red-400" },
          { icon: Globe, label: "Countries", value: stats.countries, color: "text-blue-400" },
          { icon: Wifi, label: "Services", value: stats.services, color: "text-purple-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold font-mono text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="scan" className="space-y-4">
        <TabsList className="bg-card border border-border/50">
          <TabsTrigger value="scan" className="font-mono text-xs gap-1.5">
            <Radar className="w-3.5 h-3.5" /> Scanner
          </TabsTrigger>
          <TabsTrigger value="search" className="font-mono text-xs gap-1.5">
            <Search className="w-3.5 h-3.5" /> Search Index
          </TabsTrigger>
        </TabsList>

        {/* SCANNER TAB */}
        <TabsContent value="scan" className="space-y-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Scan Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-mono text-muted-foreground mb-1.5 block">
                    Target IP / Range (e.g. 8.8.8.8 or 1.1.1.1-1.1.1.5)
                  </label>
                  <Input
                    placeholder="Enter IP address or range..."
                    value={ipRange}
                    onChange={(e) => setIpRange(e.target.value)}
                    className="font-mono bg-background/50"
                    disabled={scanning}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={scanning ? undefined : startScan}
                    disabled={scanning}
                    className="gap-2 font-mono"
                  >
                    {scanning ? (
                      <>
                        <Square className="w-4 h-4" /> Scanning...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" /> Start Scan
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Port Selection */}
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1.5 block">
                  Target Ports
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_PORTS.map(({ port, label }) => (
                    <button
                      key={port}
                      onClick={() => togglePort(port)}
                      className={`px-3 py-1.5 rounded text-xs font-mono border transition-all ${
                        selectedPorts.includes(port)
                          ? "bg-primary/20 border-primary/50 text-primary"
                          : "bg-background/30 border-border/50 text-muted-foreground hover:border-border"
                      }`}
                    >
                      {port} <span className="opacity-60">({label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scan Progress */}
              {scanning && (
                <div className="space-y-2">
                  <Progress value={undefined} className="h-1.5" />
                  <p className="text-xs font-mono text-muted-foreground animate-pulse">
                    Scanning in progress...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Terminal Output */}
          {scanLogs.length > 0 && (
            <Card className="bg-black/60 border-border/50">
              <CardHeader className="py-2 px-4 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-mono text-muted-foreground">
                    scan_output.log
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div
                  ref={logRef}
                  className="max-h-64 overflow-y-auto p-4 font-mono text-xs space-y-0.5"
                >
                  {scanLogs.map((log, i) => (
                    <div
                      key={i}
                      className={`${
                        log.startsWith("[✓]")
                          ? "text-emerald-400"
                          : log.startsWith("[!]")
                          ? "text-red-400"
                          : log.startsWith("[-]")
                          ? "text-muted-foreground/50"
                          : "text-blue-300"
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live Results */}
          {liveResults.length > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  Scan Results ({liveResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground">
                        <th className="text-left py-2 pr-4">IP</th>
                        <th className="text-left py-2 pr-4">Port</th>
                        <th className="text-left py-2 pr-4">Service</th>
                        <th className="text-left py-2 pr-4">Banner</th>
                        <th className="text-left py-2 pr-4">Location</th>
                        <th className="text-left py-2">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveResults.map((r, i) => (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="border-b border-border/10 hover:bg-primary/5"
                        >
                          <td className="py-2 pr-4 text-foreground">{r.ip}</td>
                          <td className="py-2 pr-4 text-primary">{r.port}</td>
                          <td className="py-2 pr-4">{r.service}</td>
                          <td className="py-2 pr-4 text-muted-foreground max-w-[200px] truncate">
                            {r.banner || "—"}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {r.country ? `${r.country}${r.city ? `, ${r.city}` : ""}` : "—"}
                          </td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded border text-xs ${riskBg(r.risk_score)}`}>
                              {r.risk_score}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* SEARCH TAB */}
        <TabsContent value="search" className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search IPs, services, banners, countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 font-mono bg-background/50"
              />
            </div>
            <Button variant="outline" onClick={exportCSV} className="gap-2 font-mono text-xs">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="bg-background/50 border border-border/50 rounded px-3 py-1.5 text-xs font-mono text-foreground"
            >
              <option value="">All Countries</option>
              {uniqueCountries.map((c) => (
                <option key={c} value={c!}>{c}</option>
              ))}
            </select>
            <select
              value={filterPort}
              onChange={(e) => setFilterPort(e.target.value)}
              className="bg-background/50 border border-border/50 rounded px-3 py-1.5 text-xs font-mono text-foreground"
            >
              <option value="">All Ports</option>
              {uniquePorts.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              className="bg-background/50 border border-border/50 rounded px-3 py-1.5 text-xs font-mono text-foreground"
            >
              <option value="">All Services</option>
              {uniqueServices.map((s) => (
                <option key={s} value={s!}>{s}</option>
              ))}
            </select>
            {(filterCountry || filterPort || filterService) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFilterCountry(""); setFilterPort(""); setFilterService(""); }}
                className="text-xs font-mono"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Results Table */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left p-3">IP Address</th>
                      <th className="text-left p-3">Port</th>
                      <th className="text-left p-3">Service</th>
                      <th className="text-left p-3">Banner</th>
                      <th className="text-left p-3">Country</th>
                      <th className="text-left p-3">Organization</th>
                      <th className="text-left p-3">Risk</th>
                      <th className="text-left p-3">Scanned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHosts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          {indexedHosts.length === 0
                            ? "No hosts indexed yet. Run a scan to populate the database."
                            : "No results match your filters."}
                        </td>
                      </tr>
                    ) : (
                      filteredHosts.slice(0, 100).map((h) => (
                        <tr key={h.id} className="border-b border-border/10 hover:bg-primary/5 transition-colors">
                          <td className="p-3 text-foreground">{h.ip}</td>
                          <td className="p-3 text-primary">{h.port}</td>
                          <td className="p-3">{h.service || "—"}</td>
                          <td className="p-3 text-muted-foreground max-w-[180px] truncate">
                            {h.banner || "—"}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {h.country || "—"}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground truncate max-w-[140px]">
                            {h.organization || "—"}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded border text-xs ${riskBg(h.risk_score)}`}>
                              {h.risk_score}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground/60">
                            {new Date(h.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredHosts.length > 100 && (
                <div className="p-3 text-center text-xs text-muted-foreground border-t border-border/20">
                  Showing 100 of {filteredHosts.length} results
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShodanPage;
