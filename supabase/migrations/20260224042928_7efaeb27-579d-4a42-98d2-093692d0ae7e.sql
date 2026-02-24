
-- Table to store scanned host results
CREATE TABLE public.scanned_hosts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip TEXT NOT NULL,
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  service TEXT,
  banner TEXT,
  country TEXT,
  city TEXT,
  organization TEXT,
  asn TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  risk_score INTEGER NOT NULL DEFAULT 0,
  scan_session_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast searching
CREATE INDEX idx_scanned_hosts_ip ON public.scanned_hosts(ip);
CREATE INDEX idx_scanned_hosts_port ON public.scanned_hosts(port);
CREATE INDEX idx_scanned_hosts_service ON public.scanned_hosts(service);
CREATE INDEX idx_scanned_hosts_country ON public.scanned_hosts(country);
CREATE INDEX idx_scanned_hosts_risk ON public.scanned_hosts(risk_score DESC);
CREATE INDEX idx_scanned_hosts_created ON public.scanned_hosts(created_at DESC);

-- Full text search index
ALTER TABLE public.scanned_hosts ADD COLUMN fts tsvector 
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(ip, '') || ' ' || coalesce(service, '') || ' ' || coalesce(banner, '') || ' ' || coalesce(country, '') || ' ' || coalesce(organization, ''))
  ) STORED;
CREATE INDEX idx_scanned_hosts_fts ON public.scanned_hosts USING gin(fts);

-- Enable RLS (public read for educational dashboard, insert only via edge function using service role)
ALTER TABLE public.scanned_hosts ENABLE ROW LEVEL SECURITY;

-- Anyone can read scan results (educational/public dashboard)
CREATE POLICY "Anyone can view scanned hosts"
  ON public.scanned_hosts FOR SELECT
  USING (true);

-- Only service role (edge functions) can insert
-- No insert policy for anon/authenticated means only service_role can insert

-- Enable realtime for live scan updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.scanned_hosts;
