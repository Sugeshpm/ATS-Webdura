import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Notify HR of a new application. Best-effort: any error is logged and swallowed
 * — the applicant should never see a 500 because our SMTP is misconfigured.
 *
 * Backends:
 *   - Resend (if RESEND_API_KEY is set)
 *   - Otherwise: no-op (log only)
 *
 * Recipients: HR_NOTIFY_EMAIL env var + every super_admin/recruiter in the tenant.
 */
export async function notifyHR(params: {
  tenant_id: string;
  candidate_id: string;
  application_id: string;
  job_id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  job_title: string;
  reference: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "careers@webdura.in";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ats-webdura.vercel.app";

  const recipients = await gatherRecipients(params.tenant_id);
  if (recipients.length === 0) {
    console.warn("[public-intake/notify] no recipients configured for tenant", params.tenant_id);
    return;
  }

  const subject = `New application: ${params.first_name} ${params.last_name ?? ""} — ${params.job_title}`;
  const candidateUrl = `${appUrl}/candidates/${params.candidate_id}`;
  const html = `
    <p>A new application was submitted via the Webdura careers form.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Name</b></td><td>${escapeHtml(params.first_name)} ${escapeHtml(params.last_name ?? "")}</td></tr>
      <tr><td><b>Email</b></td><td>${escapeHtml(params.email)}</td></tr>
      <tr><td><b>Job</b></td><td>${escapeHtml(params.job_title)}</td></tr>
      <tr><td><b>Reference</b></td><td>${escapeHtml(params.reference)}</td></tr>
    </table>
    <p><a href="${candidateUrl}">Open in HRM</a></p>
  `;

  if (!apiKey) {
    console.info("[public-intake/notify] RESEND_API_KEY not set — would have emailed:", recipients, subject);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: recipients, subject, html })
    });
    if (!res.ok) console.warn("[public-intake/notify] Resend responded", res.status, await res.text());
  } catch (e) {
    console.warn("[public-intake/notify] send failed:", (e as Error).message);
  }
}

async function gatherRecipients(tenantId: string): Promise<string[]> {
  const admin = createServiceClient();
  const shared = process.env.HR_NOTIFY_EMAIL;
  const emails = new Set<string>();
  if (shared) shared.split(",").map((s) => s.trim()).filter(Boolean).forEach((e) => emails.add(e));

  const { data } = await admin
    .from("profiles").select("email, role, status")
    .eq("tenant_id", tenantId)
    .in("role", ["super_admin", "recruiter"])
    .eq("status", "approved");
  for (const p of (data as Array<{ email: string | null }> | null) ?? []) {
    if (p.email) emails.add(p.email);
  }
  return [...emails];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));
}
