-- 097_ip_geo_cache.sql
-- Coarse geolocation cache for audit-log login IPs (country + region only).
--
-- The super-admin "Logins & Activity" dashboard resolves a login's source IP
-- (activity_log.ip_address, migration 096) to an approximate country + region for
-- display. Resolution is done lazily by the resolve-ip-geo edge function, which
-- writes results here so each unique IP is sent to the upstream geo provider at
-- most once, ever — a data-minimization measure for the platform's tenant-isolation
-- / GDPR-APPI-PDP posture.
--
-- PRIVACY: stores only ISO-3166 country code + region (subdivision) name. No city,
-- coordinates, ISP, or raw provider payload is retained. The keyed IP is the same
-- value already held (system-admin-only) in activity_log, under the same access model.
--
-- WRITES: only the edge function (service role, bypasses RLS) upserts here. As with
-- activity_log, there is intentionally NO client write policy. READS: system-admin only.

CREATE TABLE IF NOT EXISTS public.ip_geo_cache (
  ip            inet PRIMARY KEY,
  country_code  text,         -- ISO 3166-1 alpha-2 (e.g. 'US'); NULL = unresolved / private
  region        text,         -- subdivision / state / province name; NULL = unknown
  resolved_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ip_geo_cache IS
  'Coarse (country + region) geolocation cache for audit-log login IPs. Edge-function written; system-admin read only.';

ALTER TABLE public.ip_geo_cache ENABLE ROW LEVEL SECURITY;

-- Defense in depth: the dashboard reads geo via the edge function, but if a future
-- client queries this table directly, restrict it to system admins (audit pattern).
CREATE POLICY "ip_geo_cache_select_system_admin"
  ON public.ip_geo_cache FOR SELECT TO authenticated
  USING (is_system_admin());
