import { createServiceClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/encrypt";
import { getLead, MetaGraphError, type MetaLead } from "./graph";
import { mapMetaLeadToCandidate } from "./mapping";

export type IngestStatus = "inserted" | "duplicate" | "failed";

export interface IngestResult {
  leadgen_id: string;
  status: IngestStatus;
  candidate_id?: string;
  application_id?: string;
  error?: string;
}

interface MetaLeadForm {
  id: string;
  tenant_id: string;
  page_id: string;
  form_id: string;
  form_name: string | null;
  job_id: string | null;
  field_mapping: Record<string, string>;
  page_access_token_encrypted: string | null;
}

/**
 * Ingest a single lead. Idempotent — safe to call for the same leadgen_id repeatedly.
 * Runs with a service-role Supabase client because the webhook has no session context.
 */
export async function ingestMetaLead(
  leadgenId: string,
  formId: string,
  pageId: string,
  metaCreatedTime?: string
): Promise<IngestResult> {
  const admin = createServiceClient();

  // 1. Resolve form + tenant + access token
  const { data: formRow, error: formErr } = await admin
    .from("meta_lead_forms")
    .select("id, tenant_id, page_id, form_id, form_name, job_id, field_mapping, page_access_token_encrypted, is_active")
    .eq("form_id", formId)
    .eq("is_active", true)
    .maybeSingle();

  if (formErr || !formRow) {
    return { leadgen_id: leadgenId, status: "failed", error: `Form ${formId} not registered or inactive.` };
  }
  const form = formRow as unknown as MetaLeadForm & { is_active: boolean };

  if (!form.page_access_token_encrypted) {
    return { leadgen_id: leadgenId, status: "failed", error: "Form has no page access token stored." };
  }

  let token: string;
  try { token = decrypt(form.page_access_token_encrypted); }
  catch (e) {
    return { leadgen_id: leadgenId, status: "failed", error: `Token decrypt failed: ${(e as Error).message}` };
  }

  // 2. Dedupe raw event
  const existingRaw = await admin
    .from("meta_leads_raw")
    .select("id, candidate_id, application_id, status")
    .eq("tenant_id", form.tenant_id)
    .eq("leadgen_id", leadgenId)
    .maybeSingle();

  // Already successfully synced? Never insert again — return the prior result.
  // (A prior "failed" / "received" row falls through so a re-sync can retry it.)
  const priorStatus = existingRaw.data ? (existingRaw.data as { status: string }).status : null;
  if (priorStatus === "inserted" || priorStatus === "duplicate") {
    const row = existingRaw.data as { candidate_id: string | null; application_id: string | null };
    return {
      leadgen_id: leadgenId,
      status: priorStatus === "duplicate" ? "duplicate" : "inserted",
      candidate_id: row.candidate_id ?? undefined,
      application_id: row.application_id ?? undefined
    };
  }

  // 3. Fetch full lead from Meta
  let lead: MetaLead;
  try { lead = await getLead(token, leadgenId); }
  catch (e) {
    const msg = e instanceof MetaGraphError ? `Graph API ${e.status} (code ${e.code}): ${e.message}` : (e as Error).message;
    await upsertRawEvent(admin, {
      tenant_id: form.tenant_id, leadgen_id: leadgenId, form_id: formId, page_id: pageId,
      meta_created_time: metaCreatedTime, raw_payload: { error: msg }, status: "failed", error: msg
    });
    return { leadgen_id: leadgenId, status: "failed", error: msg };
  }

  // 4. Map to candidate schema
  const mapped = mapMetaLeadToCandidate(lead, form.field_mapping ?? {});
  if (!mapped.first_name.trim()) {
    const err = "Lead has no first_name or full_name — cannot create candidate.";
    await upsertRawEvent(admin, {
      tenant_id: form.tenant_id, leadgen_id: leadgenId, form_id: formId, page_id: pageId,
      meta_created_time: metaCreatedTime, raw_payload: lead as unknown as Record<string, unknown>,
      status: "failed", error: err
    });
    return { leadgen_id: leadgenId, status: "failed", error: err };
  }

  // 5. Dedupe candidate by (tenant, email) first, then by (tenant, external_id).
  let candidateId: string | null = null;
  if (mapped.email) {
    const existingByEmail = await admin
      .from("candidates").select("id")
      .eq("tenant_id", form.tenant_id).eq("email", mapped.email)
      .maybeSingle();
    if (existingByEmail.data) candidateId = (existingByEmail.data as { id: string }).id;
  }
  if (!candidateId) {
    const existingByExt = await admin
      .from("candidates").select("id")
      .eq("tenant_id", form.tenant_id)
      .eq("external_source", "meta_lead_ads").eq("external_id", leadgenId)
      .maybeSingle();
    if (existingByExt.data) candidateId = (existingByExt.data as { id: string }).id;
  }

  // 6. Insert candidate if new
  if (!candidateId) {
    // Only include fields that actually have a value so we don't null-out column defaults.
    const candidateInsert: Record<string, unknown> = {
      tenant_id: form.tenant_id,
      first_name: mapped.first_name,
      source: "meta_lead_ads",
      external_source: "meta_lead_ads",
      external_id: leadgenId,
      category: "active",
      middle_name: mapped.middle_name,
      last_name: mapped.last_name,
      email: mapped.email,
      phone: mapped.phone,
      gender: mapped.gender,
      date_of_birth: mapped.date_of_birth,
      current_company: mapped.current_company,
      current_location: mapped.current_location,
      preferred_location: mapped.preferred_location,
      experience_years: mapped.experience_years,
      experience_months: mapped.experience_months,
      notice_period_days: mapped.notice_period_days,
      current_salary: mapped.current_salary,
      expected_salary: mapped.expected_salary,
      linkedin_url: mapped.linkedin_url,
      github_url: mapped.github_url,
      portfolio_url: mapped.portfolio_url
    };
    for (const k of Object.keys(candidateInsert)) {
      const v = candidateInsert[k];
      if (v === null || v === undefined || v === "") delete candidateInsert[k];
    }

    const { data: inserted, error: insErr } = await admin
      .from("candidates").insert(candidateInsert as never).select("id").single();
    if (insErr || !inserted) {
      const err = insErr?.message ?? "candidate insert failed";
      await upsertRawEvent(admin, {
        tenant_id: form.tenant_id, leadgen_id: leadgenId, form_id: formId, page_id: pageId,
        meta_created_time: metaCreatedTime, raw_payload: lead as unknown as Record<string, unknown>,
        status: "failed", error: err
      });
      return { leadgen_id: leadgenId, status: "failed", error: err };
    }
    candidateId = (inserted as { id: string }).id;
  }

  // 7. Application link (idempotent per candidate + job pair)
  let applicationId: string | null = null;
  let duplicateApp = false;
  if (form.job_id) {
    // Look up sourced stage
    const { data: sourcedStage } = await admin
      .from("stages").select("id").eq("tenant_id", form.tenant_id).eq("code", "sourced").maybeSingle();
    const sourcedStageId = (sourcedStage as { id: string } | null)?.id ?? null;

    const { data: existingApp } = await admin
      .from("applications").select("id")
      .eq("tenant_id", form.tenant_id).eq("candidate_id", candidateId).eq("job_id", form.job_id)
      .maybeSingle();

    if (existingApp) {
      applicationId = (existingApp as { id: string }).id;
      duplicateApp = true;
    } else {
      const { data: app, error: aErr } = await admin.from("applications").insert({
        tenant_id: form.tenant_id,
        candidate_id: candidateId,
        job_id: form.job_id,
        current_stage_id: sourcedStageId,
        applied_via: "meta_lead_ads"
      } as never).select("id").single();
      if (!aErr && app) applicationId = (app as { id: string }).id;
    }
  }

  // 7b. Capture unmapped form questions (custom fields) as a note on the application.
  //     Notes are application-scoped, so this only runs when the form maps to a job.
  if (applicationId && Object.keys(mapped.customFields).length > 0) {
    await admin.from("notes").insert({
      tenant_id: form.tenant_id,
      application_id: applicationId,
      author_id: null,
      body: buildMetaLeadNote(mapped.customFields, lead)
    } as never);
  }

  const finalStatus: IngestStatus = duplicateApp ? "duplicate" : "inserted";

  // 8. Upsert raw event with final links
  await upsertRawEvent(admin, {
    tenant_id: form.tenant_id, leadgen_id: leadgenId, form_id: formId, page_id: pageId,
    meta_created_time: metaCreatedTime, raw_payload: lead as unknown as Record<string, unknown>,
    status: finalStatus, candidate_id: candidateId, application_id: applicationId
  });

  // 9. Audit log
  await admin.from("audit_logs").insert({
    tenant_id: form.tenant_id,
    action: "meta_lead_ingested",
    entity: "candidate",
    entity_id: candidateId,
    before: null,
    after: { leadgen_id: leadgenId, form_id: formId, page_id: pageId, status: finalStatus, application_id: applicationId }
  } as never);

  return { leadgen_id: leadgenId, status: finalStatus, candidate_id: candidateId, application_id: applicationId ?? undefined };
}

/** Turn a Meta field key ("what_is_your_notice_period") into a readable question. */
function prettifyQuestion(key: string): string {
  const s = key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key;
}

/** Build a note body listing each unmapped question and its answer. */
function buildMetaLeadNote(custom: Record<string, string>, lead: MetaLead): string {
  const lines = Object.entries(custom).map(([q, a]) => `• ${prettifyQuestion(q)}: ${a}`);
  const context: string[] = [];
  if (lead.campaign_name) context.push(`Campaign: ${lead.campaign_name}`);
  if (lead.ad_name) context.push(`Ad: ${lead.ad_name}`);
  const header = "Additional answers from the Meta Lead form" + (context.length ? ` (${context.join(" · ")})` : "");
  return `${header}\n${lines.join("\n")}`;
}

interface RawUpsert {
  tenant_id: string;
  leadgen_id: string;
  form_id: string;
  page_id: string;
  meta_created_time?: string;
  raw_payload: Record<string, unknown>;
  status: "received" | "mapped" | "inserted" | "duplicate" | "failed";
  candidate_id?: string | null;
  application_id?: string | null;
  error?: string;
}

async function upsertRawEvent(admin: ReturnType<typeof createServiceClient>, row: RawUpsert) {
  await admin.from("meta_leads_raw").upsert(
    {
      tenant_id: row.tenant_id,
      leadgen_id: row.leadgen_id,
      form_id: row.form_id,
      page_id: row.page_id,
      meta_created_time: row.meta_created_time ?? null,
      raw_payload: row.raw_payload,
      status: row.status,
      candidate_id: row.candidate_id ?? null,
      application_id: row.application_id ?? null,
      error: row.error ?? null
    } as never,
    { onConflict: "tenant_id,leadgen_id" }
  );
}

/** Just record the initial `received` event — used by the webhook before the async ingest starts. */
export async function recordReceivedEvent(
  tenantId: string,
  leadgenId: string,
  formId: string,
  pageId: string,
  metaCreatedTime?: string
) {
  const admin = createServiceClient();
  await admin.from("meta_leads_raw").upsert(
    {
      tenant_id: tenantId, leadgen_id: leadgenId, form_id: formId, page_id: pageId,
      meta_created_time: metaCreatedTime ?? null, raw_payload: { pending: true }, status: "received"
    } as never,
    { onConflict: "tenant_id,leadgen_id", ignoreDuplicates: true }
  );
}

/** Resolve a form_id to its tenant + form row without spending a Graph API call. */
export async function resolveFormTenant(formId: string): Promise<{ tenant_id: string; form_id: string } | null> {
  const admin = createServiceClient();
  const { data } = await admin
    .from("meta_lead_forms")
    .select("tenant_id, form_id")
    .eq("form_id", formId)
    .maybeSingle();
  return (data as { tenant_id: string; form_id: string } | null) ?? null;
}
