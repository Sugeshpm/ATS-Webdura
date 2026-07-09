import type { MetaFieldDatum, MetaLead } from "./graph";

/**
 * Default mapping from Meta Lead form field names to candidate columns.
 * Field names shown are the ones Meta uses for its built-in questions.
 * Custom questions fall through into `customFields` and are stored on
 * meta_leads_raw.raw_payload for audit; they are not written to candidate columns.
 */
export const DEFAULT_META_FIELD_MAPPING: Record<string, string> = {
  full_name:        "full_name",       // Split into first_name + last_name at read time
  first_name:       "first_name",
  last_name:        "last_name",
  email:            "email",
  work_email:       "email",
  phone_number:     "phone",
  city:             "city",
  state:            "state",
  country:          "country",
  date_of_birth:    "date_of_birth",
  gender:           "gender",
  company_name:     "current_company",
  linkedin_profile: "linkedin_url"
};

/**
 * Candidate profile fields a Meta form question can be mapped to.
 * The `key` is the target consumed by `mapMetaLeadToCandidate`; the `label`
 * is what the admin sees in the mapping editor. `city`/`state`/`country`
 * are concatenated into `current_location`. `full_name` is auto-split.
 * Numeric targets (experience/salary/notice) parse the first number out of
 * the answer. Value `"ignore"` (see below) drops the field entirely.
 */
export const CANDIDATE_TARGET_FIELDS: { key: string; label: string }[] = [
  { key: "first_name",         label: "First name" },
  { key: "last_name",          label: "Last name" },
  { key: "middle_name",        label: "Middle name" },
  { key: "full_name",          label: "Full name (auto-split into first/last)" },
  { key: "email",              label: "Email" },
  { key: "phone",              label: "Phone" },
  { key: "gender",             label: "Gender" },
  { key: "date_of_birth",      label: "Date of birth" },
  { key: "current_company",    label: "Current company" },
  { key: "current_location",   label: "Current location" },
  { key: "preferred_location", label: "Preferred location" },
  { key: "city",               label: "City → current location" },
  { key: "state",              label: "State → current location" },
  { key: "country",            label: "Country → current location" },
  { key: "experience_years",   label: "Experience (years)" },
  { key: "experience_months",  label: "Experience (months)" },
  { key: "notice_period_days", label: "Notice period (days)" },
  { key: "current_salary",     label: "Current salary" },
  { key: "expected_salary",    label: "Expected salary" },
  { key: "linkedin_url",       label: "LinkedIn URL" },
  { key: "github_url",         label: "GitHub URL" },
  { key: "portfolio_url",      label: "Portfolio URL" }
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
  preferred_location: string | null;
  experience_years: number | null;
  experience_months: number | null;
  notice_period_days: number | null;
  current_salary: number | null;
  expected_salary: number | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
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

/** Pull the first number out of an answer (e.g. "3.5 years" → 3.5, "₹12,00,000" → 1200000). */
function toNumber(v?: string): number | null {
  if (v == null) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(v.replace(/,/g, ""));
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Same as toNumber but rounded to an integer (years/months/days columns are int). */
function toInt(v?: string): number | null {
  const n = toNumber(v);
  return n === null ? null : Math.round(n);
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

  // Location: prefer an explicit current_location, else concat city/state/country.
  const location = candidateFields.current_location
    ? candidateFields.current_location
    : ([candidateFields.city, candidateFields.state, candidateFields.country].filter(Boolean).join(", ") || null);

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
    middle_name: candidateFields.middle_name ?? middle,
    last_name: last,
    email: candidateFields.email?.toLowerCase() ?? null,
    phone: candidateFields.phone ?? null,
    gender: candidateFields.gender?.toLowerCase() ?? null,
    date_of_birth: candidateFields.date_of_birth ? coerceDate(candidateFields.date_of_birth) : null,
    current_company: candidateFields.current_company ?? null,
    current_location: location,
    preferred_location: candidateFields.preferred_location ?? null,
    experience_years: toInt(candidateFields.experience_years),
    experience_months: toInt(candidateFields.experience_months),
    notice_period_days: toInt(candidateFields.notice_period_days),
    current_salary: toNumber(candidateFields.current_salary),
    expected_salary: toNumber(candidateFields.expected_salary),
    linkedin_url: candidateFields.linkedin_url ?? null,
    github_url: candidateFields.github_url ?? null,
    portfolio_url: candidateFields.portfolio_url ?? null,
    customFields: custom
  };
}
