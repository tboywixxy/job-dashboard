"use client";

import { Star } from "lucide-react";
import type { Feedback, FeedbackSource } from "@/lib/api";

const nonEmptyText = (value: unknown) => typeof value === "string" ? value.trim() : "";
export function feedbackUserName(row: Feedback) {
  return nonEmptyText(row.user?.name) || [nonEmptyText(row.user?.firstName), nonEmptyText(row.user?.lastName)].filter(Boolean).join(" ") || nonEmptyText(row.user?.email) || "Name unavailable";
}
export function feedbackUserEmail(row: Feedback) { return nonEmptyText(row.user?.email); }
export function feedbackJobKinds(row: Feedback) {
  return [...new Set([row.jobKind, ...(Array.isArray(row.jobKinds) ? row.jobKinds : [])].map(nonEmptyText).filter(Boolean))].join(", ") || "Not specified";
}
function date(value?: string | null) {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : "Not available";
}
export function FeedbackDetails({ feedback, sources }: { feedback: Feedback; sources: FeedbackSource[] }) {
  const email = feedbackUserEmail(feedback);
  return <div className="space-y-6">
    <section className="surface p-5"><p className="eyebrow mb-3">Submitted by</p><h3 className="text-lg font-semibold break-words">{feedbackUserName(feedback)}</h3><p className="mt-1 break-words text-sm text-slate-500">{email || "Email not available"}</p>{!feedback.user && <p className="mt-3 text-xs text-slate-500">The feedback response did not include a user profile.</p>}</section>
    <dl className="feedback-detail-grid">
      <div><dt>Rating</dt><dd>{feedback.rating == null ? "Not rated" : <span className="inline-flex items-center gap-2"><Star size={17} className="fill-amber-400 text-amber-400" />{feedback.rating} / 5</span>}</dd></div>
      <div><dt>Source</dt><dd>{sources.find((source) => source.id === feedback.source)?.label || feedback.source || "Not specified"}</dd></div>
      <div><dt>Job kind</dt><dd>{feedbackJobKinds(feedback)}</dd></div>
      <div><dt>Status</dt><dd>{feedback.deletedAt || feedback.isDeleted ? "Deleted" : "Active"}</dd></div>
      <div><dt>Created</dt><dd>{date(feedback.createdAt)}</dd></div>
      {feedback.updatedAt && <div><dt>Last updated</dt><dd>{date(feedback.updatedAt)}</dd></div>}
      {feedback.deletedAt && <div><dt>Deleted</dt><dd>{date(feedback.deletedAt)}</dd></div>}
    </dl>
    <section><h3 className="mb-3 text-sm font-semibold">Full comment</h3><p className="feedback-full-comment">{feedback.comment?.trim() || "No comment left."}</p></section>
    {!!feedback.selections?.length && <section><h3 className="mb-3 text-sm font-semibold">Selected responses</h3><ul className="space-y-2">{feedback.selections.map((selection, index) => <li key={`${selection}-${index}`} className="surface p-3 text-sm break-words">{selection}</li>)}</ul></section>}
  </div>;
}
