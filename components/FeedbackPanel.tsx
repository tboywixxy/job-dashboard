"use client";
import { Skeleton } from "@/components/Skeleton";
import { CustomSelect } from "@/components/CustomSelect";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquare, RefreshCw, Search, Star, Trash2 } from "lucide-react";
import { SidePanel } from "@/components/SidePanel";
import { FeedbackDetails, feedbackUserName as userName, feedbackUserEmail, feedbackJobKinds } from "@/components/FeedbackDetails";
import { FilterBar } from "@/components/FilterBar";
import { useToasts } from "@/components/ToastNotice";
import { deleteFeedback, getFeedbackSources, getFeedbackStats, listFeedback, type Feedback, type FeedbackSource, type FeedbackFilters, type FeedbackStats, type Pagination } from "@/lib/api";

const initialFilters = { source: "", ratingMin: "", ratingMax: "", hasComment: "", jobKind: "", createdFrom: "", createdTo: "", includeDeleted: false };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";

export function FeedbackPanel({ token }: { token: string }) {
  const { notify, toasts } = useToasts();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState<FeedbackFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Feedback[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [sources, setSources] = useState<FeedbackSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [sourcesError, setSourcesError] = useState("");
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<Feedback | null>(null);
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const deletingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    listFeedback({ ...filters, page, limit }, token, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      if (page > Math.max(1, data.pagination.totalPages)) { setPage(Math.max(1, data.pagination.totalPages)); return; }
      setRows(data.feedback); setPagination(data.pagination);
    }).catch((err) => { if (!controller.signal.aborted) { setError(errorMessage(err)); notify("error", errorMessage(err)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, page, limit, token, revision, notify]);

  useEffect(() => {
    const controller = new AbortController();
    setStatsLoading(true); setStatsError("");
    getFeedbackStats({ source: filters.source, createdFrom: filters.createdFrom, createdTo: filters.createdTo }, token, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setStats(data); })
      .catch((err) => { if (!controller.signal.aborted) { setStatsError(errorMessage(err)); notify("error", `Statistics: ${errorMessage(err)}`); } })
      .finally(() => { if (!controller.signal.aborted) setStatsLoading(false); });
    return () => controller.abort();
  }, [filters.source, filters.createdFrom, filters.createdTo, token, revision, notify]);

  useEffect(() => {
    const controller = new AbortController();
    setSourcesLoading(true); setSourcesError("");
    getFeedbackSources(token, controller.signal).then((data) => { if (!controller.signal.aborted) setSources(data); })
      .catch((err) => { if (!controller.signal.aborted) { setSourcesError(errorMessage(err)); notify("error", `Sources: ${errorMessage(err)}`); } })
      .finally(() => { if (!controller.signal.aborted) setSourcesLoading(false); });
    return () => controller.abort();
  }, [token, revision, notify]);

  useEffect(() => { if (selected) dialog.current?.showModal(); else dialog.current?.close(); }, [selected]);
  const visible = useMemo(() => rows.filter((row) => [userName(row), feedbackUserEmail(row), row.comment, row.source, feedbackJobKinds(row)].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase()))), [rows, search]);
  const update = (key: keyof typeof initialFilters, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));
  const refresh = () => setRevision((value) => value + 1);
  const reset = () => { setDraft(initialFilters); setFilters(initialFilters); setPage(1); setSearch("");  };
  async function confirmDelete() {
    if (!selected?.id || deletingRef.current) return;
    deletingRef.current = true; setDeleting(true); 
    try {
      await deleteFeedback(selected.id, token);
      setSelected(null); setDetail(null); notify("success", "Feedback deleted. You can still find it with Include deleted enabled."); refresh();
    } catch (err) { notify("error", errorMessage(err)); }
    finally { deletingRef.current = false; setDeleting(false); }
  }

  return <div className="space-y-6 feedback-page">
    {!selected && !detail && toasts}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="eyebrow">Community insights</p><h2 className="mt-1 text-xl font-semibold">Every voice helps us improve.</h2></div>
      <button className="ui-button" onClick={refresh} disabled={loading || deleting}>{loading ? <Skeleton label="Refreshing feedback" className="h-4 w-16" /> : <><RefreshCw size={16} />Refresh</>}</button>
    </div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Feedback statistics" aria-busy={statsLoading}>
      <div className="stat-card stat-featured"><div className="flex items-center justify-between"><p>Total feedback</p><MessageSquare size={20} /></div><strong>{statsLoading ? <Skeleton className="h-9 w-24" label="Loading total feedback" /> : statsError ? "Unavailable" : stats?.totalFeedback.toLocaleString() ?? "—"}</strong><span>Across the selected source and dates</span></div>
      <div className="stat-card"><div className="flex items-center justify-between"><p>Average rating</p><Star size={20} className="text-amber-500" /></div><strong>{statsLoading ? <Skeleton className="h-9 w-20" label="Loading average rating" /> : statsError ? "—" : stats?.averageRating == null ? "No ratings" : stats.averageRating.toFixed(1)}<small> / 5</small></strong><span>A snapshot of user satisfaction</span></div>
      <div className="stat-card sm:col-span-2 xl:col-span-1"><p>Feedback by source</p><div className="mt-4 flex max-h-28 flex-wrap gap-2 overflow-auto">{statsLoading ? <Skeleton className="h-7 w-full" label="Loading sources" /> : statsError ? <span>Unavailable</span> : stats?.bySource.length ? stats.bySource.map((item) => <span className="source-count" key={item.source}>{item.source}<b>{item.count.toLocaleString()}</b></span>) : <span>No source activity yet</span>}</div></div>
    </section>
    <FilterBar label="Filter feedback" summary={Object.entries(filters).filter(([, value]) => value !== "" && value !== false && value !== undefined).map(([key, value]) => `${({ source: "Source", ratingMin: "Min rating", ratingMax: "Max rating", hasComment: "Has comment", jobKind: "Job kind", createdFrom: "From", createdTo: "To", includeDeleted: "Include deleted" } as Record<string, string>)[key]}: ${value}`).join(" / ") || "All feedback"}>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (draft.ratingMin && draft.ratingMax && Number(draft.ratingMin) > Number(draft.ratingMax)) { notify("error", "Minimum rating cannot exceed maximum rating."); return; }
      if (draft.createdFrom && draft.createdTo && draft.createdFrom > draft.createdTo) { notify("error", "Start date cannot be after end date."); return; }
       setPage(1); setFilters({ ...draft, jobKind: draft.jobKind.trim() });
    }}>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="field-label">Source{sourcesLoading ? <Skeleton className="h-11 w-full" label="Loading sources" /> : <CustomSelect ariaLabel="Source" disabled={!!sourcesError} value={draft.source} onChange={(value) => update("source", value)} options={[{ value: "", label: "All sources" }, ...sources.map((source) => ({ value: source.id, label: source.label }))]} />}</div>
        <fieldset className="min-w-0"><legend className="field-legend">Rating range</legend><div className="grid grid-cols-2 gap-2">{(["ratingMin", "ratingMax"] as const).map((key, index) => <CustomSelect key={key} ariaLabel={index ? "Maximum rating" : "Minimum rating"} value={draft[key]} onChange={(value) => update(key, value)} options={[{ value: "", label: index ? "Max rating" : "Min rating" }, ...[1,2,3,4,5].map((rating) => ({ value: String(rating), label: `${rating} ${rating === 1 ? "star" : "stars"}` }))]} />)}</div></fieldset>
        <div className="field-label">Comment<CustomSelect ariaLabel="Comment" value={draft.hasComment} onChange={(value) => update("hasComment", value)} options={[{ value: "", label: "All feedback" }, { value: "true", label: "With a comment" }, { value: "false", label: "Without a comment" }]} /></div>
        <label className="field-label">Job kind<input placeholder="All job kinds" value={draft.jobKind} onChange={(e) => update("jobKind", e.target.value)} /></label>
        <label className="field-label">From date<input type="date" value={draft.createdFrom} onChange={(e) => update("createdFrom", e.target.value)} /></label>
        <label className="field-label">To date<input type="date" value={draft.createdTo} onChange={(e) => update("createdTo", e.target.value)} /></label>
        <label className="flex items-center gap-3 self-end py-3 text-sm"><input className="h-4 w-4 accent-green-600" type="checkbox" role="switch" checked={draft.includeDeleted} onChange={(e) => update("includeDeleted", e.target.checked)} />Include deleted</label>
        <div className="flex items-end justify-end gap-2"><button type="button" className="ui-button" onClick={reset}>Reset</button><button className="ui-button ui-primary" type="submit">Apply filters</button></div>
      </div>
      {sourcesError && <button type="button" className="ui-button mt-3" onClick={refresh}>Retry loading sources</button>}
    </form>
    </FilterBar>

    <section className="surface overflow-hidden" aria-label="Feedback results" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="font-semibold">All feedback <span className="count-pill">{loading ? <Skeleton className="h-4 w-6" label="Loading feedback count" /> : error ? "—" : pagination?.total ?? 0}</span></h2><p className="mt-1 text-xs text-slate-500">Select a feedback entry to view the full submission</p></div><label className="feedback-search"><Search size={17} /><input aria-label="Search current page" placeholder="Search this page…" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
      {loading ? <div role="status" className="p-5 space-y-4"><span className="sr-only">Loading feedback</span>{[1,2,3,4,5].map((row) => <Skeleton key={row} className="h-14 w-full rounded-xl" />)}</div> : error ? <div role="alert" className="feedback-state"><MessageSquare /><h3>We couldn’t load feedback</h3><button className="ui-button" onClick={refresh}>Try again</button></div> : !visible.length ? <div className="feedback-state"><MessageSquare /><h3>{search ? "No matches on this page" : "No feedback found"}</h3><p>{search ? "Try another name, email, or comment." : "Feedback will appear here when users share their experience. Try adjusting your filters."}</p><button className="ui-button" onClick={reset}>Clear filters and search</button></div> : <div className="overflow-x-auto"><table className="mobile-card-table feedback-table"><thead><tr>{["User", "Rating", "Comment", "Source", "Job kind", "Created", ""].map((title) => <th key={title} scope="col">{title || <span className="sr-only">Actions</span>}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.id} className="feedback-clickable-row" onClick={(event) => { if (!(event.target as HTMLElement).closest("button, a, input")) setDetail(row); }}><td data-label="User"><div className="flex items-center gap-3"><span className="user-avatar">{userName(row).slice(0, 2).toUpperCase()}</span><div><p className="font-medium">{userName(row)}</p><p className="mt-1 text-xs text-slate-500">{feedbackUserEmail(row) || "Email not available"}</p></div></div></td><td data-label="Rating"><span className="inline-flex items-center gap-1.5 font-semibold"><Star size={15} className="fill-amber-400 text-amber-400" />{row.rating ?? "Not rated"}{row.rating != null && <span className="text-xs font-normal text-slate-400">/ 5</span>}</span></td><td data-label="Comment" className="feedback-comment">{row.comment?.trim() || <span className="italic text-slate-400">No comment left</span>}{(row.deletedAt || row.isDeleted) && <span className="mt-2 block text-xs text-red-600">Deleted</span>}</td><td data-label="Source"><span className="source-count">{sources.find((source) => source.id === row.source)?.label || row.source || "Not specified"}</span></td><td data-label="Job kind">{feedbackJobKinds(row)}</td><td data-label="Created" className="whitespace-nowrap">{Number.isNaN(Date.parse(row.createdAt)) ? "—" : <time dateTime={row.createdAt} title={new Date(row.createdAt).toLocaleString()}>{new Date(row.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time>}</td><td data-label="Actions"><div className="flex items-center gap-2"><button type="button" className="ui-button" aria-haspopup="dialog" aria-label={`View feedback from ${userName(row)}`} onClick={() => setDetail(row)}>View</button><button className="delete-feedback" disabled={!!row.deletedAt || row.isDeleted || !row.id || deleting} aria-label={`Delete feedback from ${userName(row)}`} onClick={() => {  setSelected(row); }}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 p-4 text-xs text-slate-500"><span>{loading ? <Skeleton className="h-4 w-44" label="Loading results" /> : error ? "Results unavailable" : `${visible.length} shown on this page · ${pagination?.total ?? 0} total`}</span><div className="feedback-pagination flex flex-wrap items-center gap-3"><div className="flex items-center gap-2">Rows<CustomSelect className="w-20" ariaLabel="Rows per page" value={String(limit)} onChange={(value) => { setLimit(Number(value)); setPage(1); }} options={[10,20,50,100].map((size) => ({ value: String(size), label: String(size) }))} /></div><span>Page {page} of {Math.max(1, pagination?.totalPages ?? 1)}</span><button className="ui-button !p-2" aria-label="Previous page" disabled={loading || !!error || page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16}/></button><button className="ui-button !p-2" aria-label="Next page" disabled={loading || !!error || page >= (pagination?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16}/></button></div></div>
    </section>
    <SidePanel open={!!detail} title="Feedback details" description="The complete feedback submission" onClose={() => setDetail(null)} busy={deleting} footer={detail && <>
      <button type="button" className="ui-button" onClick={() => setDetail(null)} disabled={deleting}>Close</button>
      <button type="button" className="ui-button ui-danger" disabled={deleting || !!detail.deletedAt || detail.isDeleted || !detail.id} onClick={() => setSelected(detail)}><Trash2 size={16} />Delete feedback</button>
    </>}>
      {detail && !selected && toasts}
      {detail && <FeedbackDetails feedback={detail} sources={sources} />}
    </SidePanel>
    <dialog ref={dialog} className="feedback-dialog" aria-labelledby="delete-feedback-title" onCancel={(e) => { if (deleting) e.preventDefault(); else setSelected(null); }} onClose={() => { if (!deleting) setSelected(null); }}>{selected && toasts}<div className="p-6"><span className="delete-dialog-icon"><Trash2 size={22}/></span><h2 id="delete-feedback-title" className="mt-4 text-xl font-semibold">Delete this feedback?</h2><p className="mt-2 text-sm text-slate-500">Feedback from {selected ? userName(selected) : "this user"} will be hidden from the active list. It will remain available when you include deleted feedback.</p><div className="mt-6 flex justify-end gap-3"><button autoFocus className="ui-button" disabled={deleting} onClick={() => setSelected(null)}>Cancel</button><button className="ui-button ui-danger" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? <Skeleton label="Deleting feedback" className="h-4 w-24" /> : "Delete feedback"}</button></div></div></dialog>
  </div>;
}

