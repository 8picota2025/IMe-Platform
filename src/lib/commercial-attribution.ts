const ATTRIBUTION_KEY = 'ime_commercial_attribution';
const ANALYTICS_SESSION_KEY = 'ime_analytics_session_id';

export interface CommercialAttribution {
  lead_id?: string;
  campaign?: string;
  landing_path?: string;
  referrer?: string;
  analytics_session_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

function clean(value: unknown, max = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().slice(0, max);
  return normalized || undefined;
}

function readStored(): CommercialAttribution {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as CommercialAttribution) : {};
  } catch {
    return {};
  }
}

function analyticsSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const existing = clean(window.sessionStorage.getItem(ANALYTICS_SESSION_KEY), 80);
    if (existing) return existing;
    const created =
      typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, created);
    return created;
  } catch {
    return undefined;
  }
}

function persist(value: CommercialAttribution): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
  } catch {
    // Navegadores con storage bloqueado: attribution best-effort.
  }
}

export function captureCommercialAttribution(campaign?: string): CommercialAttribution {
  if (typeof window === 'undefined') return {};
  const stored = readStored();
  const query = new URLSearchParams(window.location.search);
  const referrer = stored.referrer ?? clean(document.referrer);
  const sessionId = stored.analytics_session_id ?? analyticsSessionId();
  const resolvedCampaign = clean(campaign, 80) ?? stored.campaign;
  const next: CommercialAttribution = {
    ...stored,
    landing_path: stored.landing_path ?? window.location.pathname,
    ...(referrer ? { referrer } : {}),
    ...(sessionId ? { analytics_session_id: sessionId } : {}),
    ...(resolvedCampaign ? { campaign: resolvedCampaign } : {}),
  };

  for (const key of [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  ] as const) {
    const value = clean(query.get(key), key === 'utm_source' || key === 'utm_medium' ? 120 : 160);
    if (value) next[key] = value;
  }
  persist(next);
  return next;
}

export function rememberCommercialLead(leadId: string, campaign?: string): CommercialAttribution {
  const cleanLeadId = clean(leadId, 80);
  const next = {
    ...captureCommercialAttribution(campaign),
    ...(cleanLeadId ? { lead_id: cleanLeadId } : {}),
  };
  persist(next);
  return next;
}
