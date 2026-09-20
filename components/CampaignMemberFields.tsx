"use client";

import { UserPlus } from "lucide-react";
import type { MemberDraft } from "@/lib/campaignMembers";

export function CampaignMemberFields({ value, onChange, disabled }: {
  value: MemberDraft; onChange: (value: MemberDraft) => void; disabled?: boolean;
}) {
  const fieldClass = "min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950";
  return <section className="grid gap-3 rounded-lg border border-slate-200 p-4">
    <button type="button" disabled={disabled} aria-expanded={value.enabled}
      onClick={() => onChange({ ...value, enabled: !value.enabled })}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50">
      <UserPlus size={16} />{value.enabled ? "Cancel adding members" : "Add members"}
    </button>
    {value.enabled && <fieldset disabled={disabled} className="grid gap-3 disabled:opacity-60">
      <p className="text-sm text-slate-500">Members receive bonus credit when you save. Existing campaign members receive a top-up.</p>
      <label className="grid gap-1 text-sm font-medium text-slate-700">Member emails or user IDs
        <textarea rows={4} value={value.entries} onChange={event => onChange({ ...value, entries: event.target.value })}
          placeholder={"ada@example.com\nuser-id:250"} className={fieldClass} />
      </label>
      <p className="text-xs text-slate-500">Separate members with commas or new lines. Add :amount for an individual bonus. Only existing Masta users can be added.</p>
      <label className="grid gap-1 text-sm font-medium text-slate-700">Default bonus per member (NGN)
        <input type="number" min="0.01" step="0.01" value={value.amount} onChange={event => onChange({ ...value, amount: event.target.value })} className={fieldClass} />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={value.notify} onChange={event => onChange({ ...value, notify: event.target.checked })} />Notify added members</label>
    </fieldset>}
  </section>;
}
