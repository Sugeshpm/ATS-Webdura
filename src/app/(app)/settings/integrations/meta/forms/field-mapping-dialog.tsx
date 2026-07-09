"use client";
import * as React from "react";
import { SlidersHorizontal, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CANDIDATE_TARGET_FIELDS, DEFAULT_META_FIELD_MAPPING, IGNORE_TARGET } from "@/lib/meta/mapping";
import { getFieldMapping, saveFieldMapping } from "../actions";

interface FormField {
  name: string;
  label?: string;
  sample?: string;
}

/** Effective target for a field: saved override → built-in default → ignore. */
function initialTarget(field: string, saved: Record<string, string>): string {
  if (saved[field]) return saved[field];
  return DEFAULT_META_FIELD_MAPPING[field.toLowerCase()] ?? IGNORE_TARGET;
}

export function FieldMappingDialog({ formId, formName }: { formId: string; formName: string }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [fields, setFields] = React.useState<FormField[]>([]);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getFieldMapping(formId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setLoadError(res.error);
        return;
      }
      setFields(res.fields);
      const init: Record<string, string> = {};
      for (const f of res.fields) init[f.name] = initialTarget(f.name, res.mapping);
      setValues(init);
    });
    return () => {
      cancelled = true;
    };
  }, [open, formId]);

  async function save() {
    setSaving(true);
    // Store explicit targets, plus "ignore" only where it overrides a default.
    const mapping: Record<string, string> = {};
    for (const f of fields) {
      const v = values[f.name] ?? IGNORE_TARGET;
      const isDefault = !!DEFAULT_META_FIELD_MAPPING[f.name.toLowerCase()];
      if (v !== IGNORE_TARGET) mapping[f.name] = v;
      else if (isDefault) mapping[f.name] = IGNORE_TARGET;
    }
    const res = await saveFieldMapping(formId, mapping);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Field mapping saved.");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs" title="Map form fields to candidate profile">
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Map fields — {formName}</DialogTitle>
          <DialogDescription>
            Choose which candidate profile field each Meta form question fills. Unmapped questions are kept on the raw
            lead payload for reference but don&apos;t populate the profile.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading form fields…
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{loadError}</div>
        )}

        {!loading && !loadError && fields.length === 0 && (
          <p className="py-8 text-sm text-muted-foreground">
            No fields discovered yet. Once this form receives its first lead (or its questions load from Meta), they&apos;ll
            appear here to map.
          </p>
        )}

        {!loading && !loadError && fields.length > 0 && (
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-surface-sunken text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Meta field</th>
                  <th className="px-3 py-2 text-left">Maps to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((f) => (
                  <tr key={f.name}>
                    <td className="px-3 py-2 align-top">
                      <div className="font-mono text-xs">{f.name}</div>
                      {f.label && <div className="text-[11px] text-muted-foreground">{f.label}</div>}
                      {f.sample && <div className="mt-0.5 text-[11px] italic text-muted-foreground">e.g. {f.sample}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={values[f.name] ?? IGNORE_TARGET}
                        onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                        className="h-8 w-full max-w-[260px] rounded-md border border-input bg-white px-2 text-xs"
                      >
                        <option value={IGNORE_TARGET}>— Don&apos;t import —</option>
                        {CANDIDATE_TARGET_FIELDS.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || loading || fields.length === 0}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? "Saving…" : "Save mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
