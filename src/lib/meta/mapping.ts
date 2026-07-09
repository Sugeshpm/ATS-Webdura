import type { MetaFieldDatum, MetaLead } from "./graph";

/**
 * Default mapping from Meta Lead form field names to candidate columns.
 * Field names shown are the ones Meta uses for its built-in questions.
 * Custom questions fall through into `customFields` and are stored on
 * meta_leads_raw.raw_payload for audit; they are not written to candidate columns.
 */
export const DEFAULT_META_FIELD_MAPPING: Record<string, string> = {
  full_name:      "full_name",       // Split into first_name + last_name at read time
  first_name:     "first_name",
  last_name:      "last_name",
  email:          "email",
  phone_number:   "phone",
  work_email:     "email",
  city:           "city",
  state:          "state",
  country:        "country",
  street_address: "address",
  post_code:      "post_code",
  date_of_birth:  "date_of_birth",
  gender:         "gender",
  job_title:      "current_company_title",
  company_name:   "current_company",
  linkedin_profile: "linkedin_url"
};

/**
 * Candidate profile fields a Meta form question can be mapped to.
 * The `key` is the target consumed by `mapMetaLeadToCandidate`; the `label`
 * is what the admin sees in the mapping editor. `city`/`state`/`country`
 * are concatenated into `current_location`. `full_name` is auto-split.
 * Value `"ignore"` (see below) drops the field entirely.
 */
export const CANDIDATE_TARGET_FIELDS: { key: string; label: string }[] = [
  { key: "first_name",      label: "First name" },
  { key: "last_name",       label: "Last name" },
  { key: "full_name",       label: "Full name (auto-split into first/last)" },
  { key: "email",           label: "Email" },
  { key: "phone",           label: "Phone" },
  { key: "current_company", label: "Current company" },
  { key: "linkedin_url",    label: "LinkedIn URL" },
  { key: "gender",          label: "Gender" },
  { key: "date_of_birth",   label: "Date of birth" },
  { key: "city",            label: "City → location" },
  { key: "state",           label: "State → location" },
  { key: "country",         label: "Country → location" }
];

/** Mapping value that explicitly drops a field (overrides a built-in default). */
export const IGNORE_TARGET = "ignore";

export interface MappedCandidate {
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;         // yyyy-mm-dd if provided
  current_company: string | null;
  current_location: string | null;
  linkedin_url: string | null;
  /** Custom answers stored as-is for meta_leads_raw.raw_payload / applications context. */
  customFields: Record<string, string>;
}

function firstValue(f: MetaFieldDatum): string | undefined {
  return (f.values ?? []).find((v) => v && v.trim().length > 0)?.trim();
}

/** Parse "Firstname Middle Lastname" into components. */
function splitName(full: string): { first: string; middle: string | null; last: string | null } {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", middle: null, last: null };
  if (parts.length === 1) return { first: parts[0], middle: null, last: null };
  if (parts.length === 2) return { first: parts[0], middle: null, last: parts[1] };
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts[parts.length - 1] };
}

/** Best-effort ISO-8601 date extraction. Meta usually returns yyyy-mm-dd already. */
function coerceDate(v: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

export function mapMetaLeadToCandidate(
  lead: MetaLead,
  customMapping: Record<string, string> = {}
): MappedCandidate {
  const mapping = { ...DEFAULT_META_FIELD_MAPPING, ...customMapping };
  const byName = new Map<string, MetaFieldDatum>();
  for (const f of lead.field_data ?? []) byName.set(f.name.toLowerCase(), f);

  const grab = (metaKey: string): string | undefined => {
    const f = byName.get(metaKey.toLowerCase());
    if (!f) return undefined;
    return firstValue(f);
  };

  // Resolve mapped fields. A candKey of "" or "ignore" drops the field —
  // this lets a saved mapping override a built-in default.
  const candidateFields: Record<string, string | undefined> = {};
  for (const [metaKey, candKey] of Object.entries(mapping)) {
    if (!candKey || candKey === IGNORE_TARGET) continue;
    const v = grab(metaKey);
    if (v !== undefined) candidateFields[candKey] = v;
  }

  // Name resolution: prefer first/last, fall back to full_name split
  let first = candidateFields.first_name;
  let middle: string | null = null;
  let last = candidateFields.last_name ?? null;
  if (!first && candidateFields.full_name) {
    const s = splitName(candidateFields.full_name);
    first = s.first;
    middle = s.middle;
    last = s.last;
  }
  if (!first) first = ""; // will fail candidate insert; caller should validate

  // Location: concat city, state, country if we have any
  const locationParts = [candidateFields.city, candidateFields.state, candidateFields.country].filter(Boolean);
  const location = locationParts.length ? locationParts.join(", ") : null;

  // Custom fields: everything in field_data that didn't map to a known column
  const knownMetaKeys = new Set(Object.keys(mapping).map((k) => k.toLowerCase()));
  const custom: Record<string, string> = {};
  for (const f of lead.field_data ?? []) {
    if (!knownMetaKeys.has(f.name.toLowerCase())) {
      const v = firstValue(f);
      if (v) custom[f.name] = v;
    }
  }

  return {
    first_name: first,
    middle_name: middle,
    last_name: last,
    email: candidateFields.email?.toLowerCase() ?? null,
    phone: candidateFields.phone ?? null,
    gender: candidateFields.gender?.toLowerCase() ?? null,
    date_of_birth: candidateFields.date_of_birth ? coerceDate(candidateFields.date_of_birth) : null,
    current_company: candidateFields.current_company ?? null,
    current_location: location,
    linkedin_url: candidateFields.linkedin_url ?? null,
    customFields: custom
  };
}
