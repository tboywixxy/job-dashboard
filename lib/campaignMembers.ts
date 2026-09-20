import type { FundMemberInput } from "@/lib/api";

export type MemberDraft = { enabled: boolean; entries: string; amount: string; notify: boolean };
export const emptyMemberDraft: MemberDraft = { enabled: false, entries: "", amount: "500", notify: true };

export function prepareCampaignMembers(draft: MemberDraft, status: string, expiresAt: string | null): FundMemberInput[] {
  if (!draft.enabled) return [];
  if (status === "ended" || status === "deleted") throw new Error("Members cannot be added to an ended or deleted campaign.");
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) throw new Error("Extend the expiry date before adding members.");
  const entries = [...new Set(draft.entries.split(/[\n,]+/).map(value => value.trim()).filter(Boolean))];
  if (!entries.length) throw new Error("Enter at least one member email or user ID.");
  const seen = new Set<string>();
  return entries.map(entry => {
    const [identifier, customAmount, extra] = entry.split(":").map(value => value.trim());
    const amount = Number(customAmount || draft.amount);
    if (!identifier || extra !== undefined || !Number.isFinite(amount) || amount <= 0) throw new Error(`Enter a positive bonus amount for ${identifier || "each member"}.`);
    const email = identifier.includes("@");
    const key = email ? identifier.toLowerCase() : identifier;
    if (seen.has(key)) throw new Error(`Remove the duplicate member: ${identifier}.`);
    seen.add(key);
    return email ? { email: key, amount } : { userId: identifier, amount };
  });
}

export function fundingResultText(data: { funded: { userId: string }[]; unmatched: { userId?: string; email?: string; reason: string }[] }) {
  return `${data.funded.length} member(s) funded.${data.unmatched.length ? ` Not added: ${data.unmatched.map(row => `${row.email || row.userId || "Unknown member"}: ${row.reason}`).join("; ")}` : ""}`;
}

export function fundingFailure(error: unknown) {
  const details = error as { status?: number; message?: string; body?: { code?: number; data?: { budgetCap?: number; alreadyGranted?: number; requested?: number } } };
  const status = details?.body?.code || details?.status || 0;
  const rejected = status >= 400 && status < 500;
  const budget = details?.body?.data;
  const budgetText = budget?.budgetCap !== undefined
    ? ` Budget cap: NGN ${budget.budgetCap}; already granted: NGN ${budget.alreadyGranted ?? 0}; requested: NGN ${budget.requested ?? 0}.`
    : "";
  return { rejected, text: `${rejected ? "Member funding was rejected." : "Member funding could not be confirmed."} ${details?.message || "Please try again."}${budgetText}${rejected ? " Correct the member details and save again." : " Check campaign members before submitting these users again."}` };
}
