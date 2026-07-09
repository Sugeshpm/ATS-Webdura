/**
 * Thin wrapper around Meta Graph API endpoints we use for Lead Ads.
 * Docs: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/
 */

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION ?? "v20.0";
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaFieldDatum {
  name: string;
  values: string[];
}

export interface MetaLead {
  id: string;
  created_time: string;
  form_id: string;
  field_data: MetaFieldDatum[];
  ad_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  ad_name?: string;
  platform?: string;
}

export interface MetaPage {
  id: string;
  name: string;
  category?: string;
}

/** A Page as returned by `/me/accounts` — carries its own long-lived Page access token. */
export interface MetaPageWithToken extends MetaPage {
  access_token: string;
}

export interface MetaLeadForm {
  id: string;
  name: string;
  status?: string;
  created_time?: string;
  questions?: { key: string; type?: string; label: string }[];
}

async function graph<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; type?: string } };
  if (!res.ok) {
    const msg = body?.error?.message ?? `${res.status} ${res.statusText}`;
    const code = body?.error?.code;
    throw new MetaGraphError(msg, code, res.status);
  }
  return body as T;
}

export class MetaGraphError extends Error {
  code?: number;
  status: number;
  constructor(msg: string, code?: number, status = 500) {
    super(msg);
    this.name = "MetaGraphError";
    this.code = code;
    this.status = status;
  }
  isAuthError() { return this.status === 401 || this.code === 190 || this.code === 200; }
}

/** Fetch the Page that owns this access token. Simplest way to verify the token works. */
export async function getPage(token: string, pageId: string): Promise<MetaPage> {
  return graph<MetaPage>(`/${pageId}`, token, { fields: "id,name,category" });
}

/**
 * List the Pages the logged-in user manages, each with its own Page access token.
 * Called right after OAuth with the user access token. When the user token is
 * long-lived, the returned Page tokens are long-lived too (effectively no expiry).
 */
export async function listPages(userToken: string): Promise<MetaPageWithToken[]> {
  const res = await graph<{ data: MetaPageWithToken[] }>(`/me/accounts`, userToken, {
    fields: "id,name,category,access_token",
    limit: "100"
  });
  return res.data ?? [];
}

/** List all Lead Ad forms owned by a Page. */
export async function listForms(token: string, pageId: string): Promise<MetaLeadForm[]> {
  const res = await graph<{ data: MetaLeadForm[] }>(`/${pageId}/leadgen_forms`, token, {
    fields: "id,name,status,created_time,questions",
    limit: "100"
  });
  return res.data ?? [];
}

/** Fetch a single Lead Ad form, including its questions (for the field-mapping editor). */
export async function getForm(token: string, formId: string): Promise<MetaLeadForm> {
  return graph<MetaLeadForm>(`/${formId}`, token, { fields: "id,name,status,questions" });
}

/** Fetch a single lead by leadgen_id. */
export async function getLead(token: string, leadgenId: string): Promise<MetaLead> {
  return graph<MetaLead>(`/${leadgenId}`, token, {
    fields: "id,created_time,form_id,field_data,ad_id,campaign_id,campaign_name,ad_name,platform"
  });
}

/**
 * List recent leads for a form. Used by manual sync / backfill.
 * `since` is a Unix timestamp (seconds) — Meta's `filtering` parameter is fussy about format.
 */
export async function listFormLeads(token: string, formId: string, since?: Date): Promise<MetaLead[]> {
  const params: Record<string, string> = {
    fields: "id,created_time,form_id,field_data,ad_id,campaign_id,campaign_name,ad_name,platform",
    limit: "100"
  };
  if (since) {
    const ts = Math.floor(since.getTime() / 1000);
    params.filtering = JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: ts }]);
  }
  const collected: MetaLead[] = [];
  let path: string | null = `/${formId}/leads`;
  let searchParams: Record<string, string> | null = params;

  // Paginate up to a hard cap so a broken loop can't run away.
  for (let i = 0; i < 100 && path; i++) {
    const res: { data: MetaLead[]; paging?: { next?: string } } = searchParams
      ? await graph(path, token, searchParams)
      // eslint-disable-next-line no-await-in-loop
      : await graphAbsolute(path);
    collected.push(...(res.data ?? []));
    if (!res.paging?.next) break;
    path = res.paging.next;
    searchParams = null;
  }
  return collected;
}

async function graphAbsolute<T>(fullUrl: string): Promise<T> {
  const res = await fetch(fullUrl, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } };
  if (!res.ok) {
    throw new MetaGraphError(body?.error?.message ?? `${res.status} ${res.statusText}`, body?.error?.code, res.status);
  }
  return body as T;
}

/**
 * Exchange an OAuth `code` (from the Facebook Login redirect) for a short-lived user token.
 * `redirectUri` must EXACTLY match the one used to build the login dialog URL.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; expires_in?: number }> {
  const url = new URL(`${BASE}/oauth/access_token`);
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string; code?: number };
  };
  if (!res.ok || !body.access_token) {
    throw new MetaGraphError(body?.error?.message ?? `Code exchange failed: ${res.status}`, body?.error?.code, res.status);
  }
  return { access_token: body.access_token, expires_in: body.expires_in };
}

/** Exchange a short-lived user token for a ~60-day long-lived one. Optional — used if we build OAuth. */
export async function exchangeForLongLived(shortToken: string): Promise<{ access_token: string; expires_in?: number }> {
  const url = new URL(`${BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new MetaGraphError(`Token exchange failed: ${res.status}`);
  return res.json();
}
