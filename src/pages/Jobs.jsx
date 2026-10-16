import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { Briefcase, Broadcast, Check, ClockCounterClockwise, Funnel, GearSix, Heart, MagnifyingGlass, Plus, Star, X } from "@phosphor-icons/react";
import Shell from "../components/Shell";
import JobCard from "../components/JobCard";
import JobDrawer from "../components/JobDrawer";
import { SortMenu } from "../components/JobListControls";
import LogoLoader from "../components/LogoLoader";
import HScroll from "../components/HScroll";
import { AddJobDialog } from "../components/dialogs";
import DateTimeRangeFilter from "../components/DateTimeRangeFilter";
import OpportunityFilterDialog from "../components/OpportunityFilterDialog";
import LiveSearchDialog from "../components/LiveSearchDialog";
import { ActiveDateFilterChip, RefreshFilterButton } from "../components/FilterToolbarControls";
import { iconButton, primaryButton } from "../components/ui";
import { api } from "../services/api";
import { EMPTY_EXTRA_FILTERS, EMPTY_REACTION_FILTER, JOB_SORTS, loadDateFilter, loadExtraFilters, loadJobScope, loadJobSort, loadJobStatus, loadReactionFilter, saveDateFilter, saveExtraFilters, saveJobScope, saveJobSort, saveJobStatus, saveReactionFilter } from "../lib/preferences";
import { EMPTY_DATE_RANGE, toGatewayDateFilter } from "../lib/dateRange";
import { clientLocation, countExtraFilters, forgetSearch, loadRecentSearches, matchesExtraFilters, rememberSearch, skillStyle, useJobReactions, usePreviewParam } from "../lib/jobSignals";
import { useJobStatus } from "../lib/jobStatus";
import ErrorBoundary, { CardError } from "../components/ErrorBoundary";
import { timeAgo, useNow } from "../lib/time";
import { useAuth } from "../contexts/AuthContext";
import { asArray, asObject, asText } from "../lib/safe";

const scopes = ["My Jobs", "All Jobs"];
const pipeline = ["New", "Applied", "Rejected"];
// "New" covers New and Seen, which the gateway cannot OR together, so only the other tabs filter on the server.
const serverStatus = (tab) => (tab === "Applied" || tab === "Rejected" ? tab : "");
const label = "text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]";
const TOOLBAR_SKILLS = 5;

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function FilterChip({ children, onClear }) {
  return <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lime)]/35 px-3 py-1.5 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/25">
    {children}
    <button type="button" onClick={onClear} aria-label={`Remove ${children} filter`} className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10"><X size={11} /></button>
  </span>;
}

export default function Jobs() {
  const { user } = useAuth();
  const now = useNow();
  const reactions = useJobReactions(user?.email);
  const jobStatus = useJobStatus();
  const [dateFilter, setDateFilter] = useState(() => loadDateFilter("jobs"));
  const gatewayDateFilter = useMemo(() => toGatewayDateFilter(dateFilter), [dateFilter]);
  const [scope, setScope] = useState(loadJobScope);
  const [tab, setTab] = useState(() => (loadJobStatus() === "Seen" ? "New" : loadJobStatus()));
  // Independent of the status tab, so e.g. Rejected + Favorites + Liked narrow the list together.
  const [reactionFilter, setReactionFilter] = useState(loadReactionFilter);
  const { favorites: favoritesOnly, liked: likedOnly } = reactionFilter;
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 450);
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches(user?.email));
  const [skills, setSkills] = useState([]);
  const [adding, setAdding] = useState(false);
  const [liveSearching, setLiveSearching] = useState(false);
  const [skillDialog, setSkillDialog] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [sort, setSort] = useState(loadJobSort);
  const [extraFilters, setExtraFilters] = useState(() => loadExtraFilters("jobs"));
  const { previewId, openPreview, closePreview } = usePreviewParam();
  const [searchFocused, setSearchFocused] = useState(false);
  const showAllJobs = scope === "All Jobs";
  const status = serverStatus(tab);
  const order = JOB_SORTS.find((item) => item.id === sort) || JOB_SORTS[0];

  const { data: jobPages, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, isError, error, refetch } = useInfiniteQuery({
    queryKey: ["jobs", showAllJobs ? "all" : user?.email, gatewayDateFilter, search, status, order.orderBy, order.orderDir],
    queryFn: ({ pageParam }) => api.getJobsPage({ page: pageParam, perPage: 20, dateFilter: gatewayDateFilter, userEmail: user.email, allJobs: showAllJobs, search, status, orderBy: order.orderBy, orderDir: order.orderDir }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    enabled: Boolean(user?.email),
    placeholderData: (previous) => previous,
  });
  const jobs = useMemo(
    () => asArray(jobPages?.pages).flatMap((page) => asArray(page?.records)).filter((job, index, records) => records.findIndex((item) => item.id === job.id) === index),
    [jobPages],
  );
  const totalMatches = jobPages?.pages?.[0]?.total;
  const { data: jobStatsData, isFetching: isFetchingStats, refetch: refetchStats } = useQuery({
    queryKey: ["job-stats", user?.email, gatewayDateFilter],
    queryFn: () => api.getJobStats({ dateFilter: gatewayDateFilter, userEmail: user.email }),
    enabled: Boolean(user?.email),
  });
  const jobStats = asObject(jobStatsData);
  const scopePrefix = showAllJobs ? "all" : "my";
  const scopeCounts = { "My Jobs": jobStats.my_total, "All Jobs": jobStats.all_total };
  const pipelineCounts = {
    New: (jobStats[`${scopePrefix}_new`] || 0) + (jobStats[`${scopePrefix}_seen`] || 0),
    Applied: jobStats[`${scopePrefix}_applied`],
    Rejected: jobStats[`${scopePrefix}_rejected`],
  };
  const { data: skillPages, isLoading: skillsLoading, isError: skillsError, error: skillsQueryError, hasNextPage: hasMoreSkills, isFetchingNextPage: isFetchingMoreSkills, fetchNextPage: fetchMoreSkills } = useInfiniteQuery({
    queryKey: ["skills"],
    queryFn: ({ pageParam }) => api.getSkills({ page: pageParam, perPage: 20 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
  });
  const root = useRef(null);
  const loadMoreRef = useRef(null);

  useEffect(() => saveDateFilter("jobs", dateFilter), [dateFilter]);
  useEffect(() => saveExtraFilters("jobs", extraFilters), [extraFilters]);
  useEffect(() => saveReactionFilter(reactionFilter), [reactionFilter]);
  useEffect(() => {
    if (hasMoreSkills && !isFetchingMoreSkills) fetchMoreSkills();
  }, [fetchMoreSkills, hasMoreSkills, isFetchingMoreSkills]);
  const skillRecords = useMemo(
    () => asArray(skillPages?.pages).flatMap((page) => asArray(page?.records)).filter((record, index, records) => records.findIndex((item) => item.id === record.id) === index).sort((a, b) => asText(a.name).localeCompare(asText(b.name))),
    [skillPages],
  );
  // Job counts per skill follow the scope and date window, like the pipeline counts; fetched once every skill page is in.
  const skillNames = useMemo(() => skillRecords.map((record) => record.name), [skillRecords]);
  const { data: skillCountsData, isFetching: isFetchingSkillCounts, refetch: refetchSkillCounts } = useQuery({
    queryKey: ["skill-counts", showAllJobs ? "all" : user?.email, gatewayDateFilter, skillNames],
    queryFn: () => api.getSkillCounts({ skills: skillNames, dateFilter: gatewayDateFilter, userEmail: user.email, allJobs: showAllJobs }),
    enabled: Boolean(user?.email) && skillNames.length > 0 && !hasMoreSkills,
    placeholderData: (previous) => previous,
  });
  const skillCounts = asObject(skillCountsData);
  // Most jobs first; ties and not-yet-counted skills stay alphabetical.
  const rankedSkillRecords = useMemo(
    () => [...skillRecords].sort((a, b) => (skillCounts[b.name] ?? -1) - (skillCounts[a.name] ?? -1) || asText(a.name).localeCompare(asText(b.name))),
    [skillRecords, skillCounts],
  );
  // The toolbar shows the top skills plus any selected one outside them; the rest sit behind "+N more".
  const shownSkillRecords = useMemo(
    () => rankedSkillRecords.filter((record, index) => index < TOOLBAR_SKILLS || skills.includes(record.name)),
    [rankedSkillRecords, skills],
  );
  const hiddenSkillCount = rankedSkillRecords.length - shownSkillRecords.length;

  const allDisplayJobs = useMemo(() => {
    const baseJobs = asArray(jobPages?.pages).flatMap((page) => asArray(page?.records)).filter((job, index, records) => records.findIndex((item) => item.id === job.id) === index);
    const baseIds = new Set(baseJobs.map((j) => j.id));
    const extraFromReactions = [];
    const relevantIds = favoritesOnly || likedOnly
      ? [...(favoritesOnly ? reactions.favorites : []), ...(likedOnly ? reactions.liked : [])]
      : [...reactions.favorites, ...reactions.liked];
    for (const id of relevantIds) {
      if (!baseIds.has(id) && reactions.jobRecords?.[id]) {
        extraFromReactions.push(reactions.jobRecords[id]);
        baseIds.add(id);
      }
    }
    return [...baseJobs, ...extraFromReactions];
  }, [jobPages, favoritesOnly, likedOnly, reactions.favorites, reactions.liked, reactions.jobRecords]);

  // A refreshed or shared ?job= link can point at a job outside the loaded pages; fetch that one on its own.
  const listedPreview = previewId ? allDisplayJobs.find((job) => job.id === previewId) : null;
  const { data: fetchedPreview, isError: previewMissing } = useQuery({
    queryKey: ["job", previewId],
    queryFn: () => api.getJob(previewId),
    enabled: Boolean(previewId) && !listedPreview,
    retry: false,
  });
  const preview = listedPreview || (fetchedPreview?.id === previewId ? fetchedPreview : null);
  useEffect(() => { if (previewMissing) closePreview(); }, [previewMissing, closePreview]);

  // Text search runs on the gateway; status "New" (New + Seen), favorites/liked and multi-skill selection are applied to the loaded pages.
  // Every active filter must match, so they all combine.
  const filtered = useMemo(
    () => allDisplayJobs.filter((job) => {
      if (tab === "New") {
        if (!["New", "Seen"].includes(job.status)) return false;
      } else if (tab !== "All") {
        if (job.status !== tab) return false;
      }
      if (favoritesOnly && !reactions.favorites.includes(job.id)) return false;
      if (likedOnly && !reactions.liked.includes(job.id)) return false;
      return matchesExtraFilters(job, extraFilters) &&
        (!skills.length || skills.some((skill) => asArray(job.skills).some((jobSkill) => asText(jobSkill).toLowerCase() === skill.toLowerCase()) || `${job.title} ${job.description}`.toLowerCase().includes(skill.toLowerCase())));
    }),
    [allDisplayJobs, tab, favoritesOnly, likedOnly, skills, extraFilters, reactions.favorites, reactions.liked],
  );

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage(); }, { rootMargin: "500px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, filtered.length]);

  // Highlight the job currently in view in the sidebar index.
  useEffect(() => {
    if (!root.current) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveId(visible.target.dataset.jobId);
    }, { rootMargin: "-35% 0px -55% 0px" });
    root.current.querySelectorAll("[data-job-id]").forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [filtered]);

  useEffect(() => {
    if (isLoading || !root.current) return undefined;
    const ctx = gsap.context(() => gsap.fromTo("[data-card]", { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.05, ease: "power3.out", clearProps: "transform" }), root);
    return () => ctx.revert();
  }, [scope, tab, reactionFilter, search, skills, dateFilter, sort, extraFilters, isLoading]);

  // Searches are saved to history on Enter, on picking a past search, or when leaving the box with a term in it.
  const commitSearch = (value = searchInput) => setRecentSearches(rememberSearch(user?.email, value));
  const applySearch = (value) => { setSearchInput(value); commitSearch(value); setSearchFocused(false); };
  const historyTerm = searchInput.trim().toLowerCase();
  const searchHistory = recentSearches.filter((term) => !historyTerm || (asText(term).toLowerCase().includes(historyTerm) && asText(term).toLowerCase() !== historyTerm));
  const changeSort = (value) => { setSort(value); saveJobSort(value); };
  const toggleSkill = (skill) => setSkills((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));
  const changeTab = (item) => { const next = tab === item ? "All" : item; setTab(next); saveJobStatus(next); };
  const toggleReactionFilter = (key) => setReactionFilter((current) => ({ ...current, [key]: !current[key] }));
  const noFavoritesYet = favoritesOnly && !reactions.favorites.length;
  const noLikedYet = likedOnly && !reactions.liked.length;
  const jumpTo = (id) => document.getElementById(`job-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  // The funnel dialog holds skills, job type and client location, so its badge counts all three.
  const filterCount = skills.length + countExtraFilters(extraFilters);
  const hasFilters = skills.length > 0 || dateFilter.preset !== "all" || searchInput || countExtraFilters(extraFilters) > 0 || favoritesOnly || likedOnly;
  const searching = isFetching && !isFetchingNextPage && searchInput.trim() === search;

  return (
    <Shell>
      <main ref={root} className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
        <section className="rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70">
          <div className="space-y-4 rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <HScroll className="xl:max-w-[56%]" innerClassName="items-center gap-2" label="job filters">
                <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--paper)] p-1" aria-label="Job scope">
                  {scopes.map((item) => <button key={item} type="button" aria-pressed={scope === item} onClick={() => { setScope(item); saveJobScope(item); }} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-300 ${scope === item ? "bg-[var(--lime)] !text-[#26320b] shadow-[0_4px_18px_rgba(105,130,32,.14)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>
                    {item}<span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${scope === item ? "bg-black/10" : "bg-black/5 dark:bg-white/10"}`}>{isFetchingStats && scopeCounts[item] == null ? "…" : scopeCounts[item] ?? 0}</span>
                  </button>)}
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--paper)] p-1" aria-label="Job status">
                  {pipeline.map((item) => <button key={item} type="button" aria-pressed={tab === item} onClick={() => changeTab(item)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-300 ${tab === item ? "bg-[var(--ink)] text-white" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>
                    {item}<span className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${tab === item ? "bg-white/15" : "bg-black/5 dark:bg-white/10"}`}>{isFetchingStats && pipelineCounts[item] == null ? "…" : pipelineCounts[item] ?? 0}</span>
                  </button>)}
                </div>
              </HScroll>
              <div className="flex flex-1 items-center gap-2">
                <form onSubmit={(event) => { event.preventDefault(); commitSearch(); setSearchFocused(false); }} className="job-search relative flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--lime)]/40 text-[var(--accent-strong)] dark:bg-[var(--lime)]/15">{searching ? <span className="size-3.5 animate-spin rounded-full border-2 border-[var(--lime-dark)]/25 border-t-[var(--lime-dark)]" /> : <MagnifyingGlass size={14} weight="bold" />}</span>
                  <input value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setSearchFocused(true); }} onFocus={() => setSearchFocused(true)} onBlur={() => { setSearchFocused(false); if (searchInput.trim()) commitSearch(); }} onKeyDown={(event) => event.key === "Escape" && setSearchFocused(false)} placeholder="Search title, description, skills…" aria-label="Search jobs" aria-expanded={searchFocused && searchHistory.length > 0} aria-controls="job-search-history" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
                  {searchInput && <button type="button" onClick={() => setSearchInput("")} aria-label="Clear search" className="grid size-5 shrink-0 place-items-center rounded-full bg-black/[.06] text-[var(--muted)] hover:bg-black/15 dark:bg-white/10"><X size={11} weight="bold" /></button>}
                  {searchFocused && searchHistory.length > 0 && <div id="job-search-history" onMouseDown={(event) => event.preventDefault()} className="absolute inset-x-0 top-[calc(100%+.5rem)] z-50 rounded-[1.4rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgba(30,32,25,.2)] ring-1 ring-black/5">
                    <div className="rounded-[calc(1.4rem-.375rem)] bg-[var(--surface)] p-2">
                      <div className="flex items-center justify-between px-2 pb-1.5 pt-1"><span className={label}>Recent searches</span><button type="button" onClick={() => { recentSearches.forEach((term) => forgetSearch(user?.email, term)); setRecentSearches([]); }} className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear history</button></div>
                      <ul>{searchHistory.map((term) => <li key={term} className="group/term flex items-center rounded-xl hover:bg-[var(--paper)]">
                        <button type="button" onClick={() => applySearch(term)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs font-semibold text-[var(--muted)] group-hover/term:text-[var(--ink)]"><ClockCounterClockwise size={14} className="shrink-0" /><span className="truncate">{term}</span></button>
                        <button type="button" onClick={() => setRecentSearches(forgetSearch(user?.email, term))} aria-label={`Forget search ${term}`} className="mr-1.5 grid size-6 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-black/10 hover:text-[var(--ink)]"><X size={11} /></button>
                      </li>)}</ul>
                    </div>
                  </div>}
                </form>
                <SortMenu value={sort} options={JOB_SORTS} onChange={changeSort} />
                <DateTimeRangeFilter value={dateFilter} onApply={setDateFilter} label="Job posting time" />
                <button type="button" onClick={() => setSkillDialog(true)} aria-label="Open job filters" title="Filters" className={`relative ${iconButton} ${filterCount ? "bg-[var(--lime)] !text-[#26320b] ring-2 ring-[var(--lime-dark)]/40" : ""}`}>
                  <Funnel size={16} weight={filterCount ? "fill" : "regular"} />
                  {filterCount > 0 && <span className="absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full bg-[var(--ink)] text-[9px] font-bold text-white">{filterCount}</span>}
                </button>
                <RefreshFilterButton onClick={() => { refetch(); refetchStats(); refetchSkillCounts(); }} loading={isFetching || isFetchingStats || isFetchingSkillCounts} label="Refresh jobs" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-black/[.06] pt-4 dark:border-white/[.08]">
              <span className={`${label} shrink-0`}>Skills</span>
              <HScroll className="min-w-0 max-w-full" innerClassName="gap-1.5" label="skills">
                {shownSkillRecords.map(({ id, name }) => {
                  const selected = skills.includes(name);
                  const count = skillCounts[name];
                  return <button key={id} type="button" onClick={() => toggleSkill(name)} aria-pressed={selected} style={skillStyle(name)} className="skill-chip inline-flex shrink-0 items-center gap-1 rounded-full py-1.5 pl-3 pr-1.5 text-[11px] font-semibold transition-transform duration-300 hover:-translate-y-0.5">
                    {selected && <Check size={11} weight="bold" />}{name}
                    <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${selected ? "bg-white/20 dark:bg-black/15" : "bg-black/5 dark:bg-white/10"}`}>{count == null ? "…" : count}</span>
                  </button>;
                })}
                {hiddenSkillCount > 0 && <button type="button" onClick={() => setSkillDialog(true)} title="Show all skills" className="shrink-0 rounded-full bg-[var(--paper)] px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]">+{hiddenSkillCount} more</button>}
                {skillsLoading && <span className="skeleton-bone h-7 w-40 shrink-0 rounded-full" />}
              </HScroll>
              <button type="button" onClick={() => setSkillDialog(true)} aria-label="Skill settings" title="Skill settings" className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--muted)] ring-1 ring-[var(--line)] transition-all duration-300 hover:rotate-45 hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]"><GearSix size={16} weight="bold" /></button>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-pressed={favoritesOnly}
                  onClick={() => toggleReactionFilter("favorites")}
                  title={reactions.favorites.length > 0 ? `Favorites (${reactions.favorites.length})` : "Favorites"}
                  aria-label="Favorites"
                  className={`grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300 hover:-translate-y-0.5 ${
                    favoritesOnly
                      ? "bg-[#fef9c3] text-[#b45309] ring-1 ring-[#fde047] shadow-sm dark:bg-[#fef08a]/20 dark:text-[#fde047] dark:ring-[#fde047]/40"
                      : "bg-[var(--paper)] text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-[#fef9c3]/60 hover:text-[#b45309] hover:ring-[#fde047]/70"
                  }`}
                >
                  <Star size={16} weight={favoritesOnly || reactions.favorites.length > 0 ? "fill" : "regular"} className={favoritesOnly ? "text-[#d97706] dark:text-[#fde047]" : reactions.favorites.length > 0 ? "text-[#f59e0b] dark:text-[#fde047]" : "currentColor"} />
                </button>
                <button
                  type="button"
                  aria-pressed={likedOnly}
                  onClick={() => toggleReactionFilter("liked")}
                  title={reactions.liked.length > 0 ? `Liked jobs (${reactions.liked.length})` : "Liked jobs"}
                  aria-label="Liked jobs"
                  className={`grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300 hover:-translate-y-0.5 ${
                    likedOnly
                      ? "bg-[#ffe4e6] text-[#e11d48] ring-1 ring-[#fecdd3] shadow-sm dark:bg-[#fda4af]/20 dark:text-[#fda4af] dark:ring-[#fda4af]/40"
                      : "bg-[var(--paper)] text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-[#ffe4e6]/60 hover:text-[#e11d48] hover:ring-[#fecdd3]/70"
                  }`}
                >
                  <Heart size={16} weight={likedOnly || reactions.liked.length > 0 ? "fill" : "regular"} className={likedOnly ? "text-[#e11d48] dark:text-[#fda4af]" : reactions.liked.length > 0 ? "text-[#fb7185] dark:text-[#fda4af]" : "currentColor"} />
                </button>
                <button type="button" onClick={() => setLiveSearching(true)} className="inline-flex items-center gap-2 rounded-full bg-[var(--lime)]/30 py-2 pl-3 pr-4 text-xs font-bold text-[var(--accent-strong)] ring-1 ring-[var(--lime-dark)]/35 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--lime)]/55">
                  <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--lime-dark)] opacity-70" /><span className="relative inline-flex size-2 rounded-full bg-[var(--lime-dark)]" /></span>
                  <Broadcast size={14} weight="bold" />Live search
                </button>
                <button type="button" onClick={() => setAdding(true)} className={`${primaryButton} !py-1.5 !pl-4`}><span>Add job</span><span className="grid size-7 place-items-center rounded-full bg-white/10"><Plus size={14} /></span></button>
              </div>
            </div>

            {hasFilters && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/[.06] pt-4 dark:border-white/[.08]">
              {favoritesOnly && <FilterChip onClear={() => toggleReactionFilter("favorites")}>Favorites only</FilterChip>}
              {likedOnly && <FilterChip onClear={() => toggleReactionFilter("liked")}>Liked only</FilterChip>}
              {extraFilters.jobType !== "any" && <FilterChip onClear={() => setExtraFilters({ ...extraFilters, jobType: "any" })}>{extraFilters.jobType === "hourly" ? "Hourly jobs" : "Fixed-price jobs"}</FilterChip>}
              {extraFilters.location !== "any" && <FilterChip onClear={() => setExtraFilters({ ...extraFilters, location: "any" })}>{`${clientLocation(extraFilters.location).label} clients`}</FilterChip>}
              <ActiveDateFilterChip value={dateFilter} onClear={() => setDateFilter(EMPTY_DATE_RANGE)} />
              <button type="button" onClick={() => { setSkills([]); setSearchInput(""); setDateFilter(EMPTY_DATE_RANGE); setExtraFilters(EMPTY_EXTRA_FILTERS); setReactionFilter(EMPTY_REACTION_FILTER); }} className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear all</button>
            </div>}
          </div>
        </section>

        <div className="mt-8">
          {isLoading ? <LogoLoader className="min-h-[38dvh]" label="Loading jobs" />
            : isError ? <section className="py-24 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--danger)]/10"><Briefcase size={22} /></div>
              <h3 className="mt-5 text-xl font-semibold">Could not load jobs</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--muted)]">{error?.message || "Check the connection and try again."}</p>
              <button type="button" onClick={() => refetch()} className={`${primaryButton} mt-5`}>Try again</button>
            </section>
              : filtered.length ? <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
                <nav aria-label="Jump to job" className="hidden lg:block">
                  <div className="sticky top-[calc(var(--shell-h)+1rem)] max-h-[calc(100dvh-var(--shell-h)-2rem)] overflow-y-auto overscroll-contain rounded-[1.5rem] bg-[var(--surface)] p-3 ring-1 ring-[var(--line)]/70 [scrollbar-width:thin]">
                    {favoritesOnly && !likedOnly ? (
                      <div className="mb-2 flex items-center justify-between border-b border-[var(--line)]/70 px-2 pb-2">
                        <p className={`${label} flex items-center gap-1.5 text-[#b45309] dark:text-[#fde047]`}>
                          <Star size={12} weight="fill" className="text-[#f59e0b] dark:text-[#fde047]" />
                          <span>Favorites</span>
                        </p>
                        <span className="rounded-full bg-[#fef9c3] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#92400e] ring-1 ring-[#fde047]/60 dark:bg-[#fef08a]/15 dark:text-[#fde047] dark:ring-[#fde047]/30">
                          {search ? `${filtered.length} matched` : `${filtered.length} ${filtered.length === 1 ? "job" : "jobs"}`}
                        </span>
                      </div>
                    ) : likedOnly && !favoritesOnly ? (
                      <div className="mb-2 flex items-center justify-between border-b border-[var(--line)]/70 px-2 pb-2">
                        <p className={`${label} flex items-center gap-1.5 text-[#be123c] dark:text-[#fda4af]`}>
                          <Heart size={12} weight="fill" className="text-[#fb7185] dark:text-[#fda4af]" />
                          <span>Liked jobs</span>
                        </p>
                        <span className="rounded-full bg-[#ffe4e6] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#be123c] ring-1 ring-[#fecdd3] dark:bg-[#fda4af]/15 dark:text-[#fda4af] dark:ring-[#fda4af]/30">
                          {search ? `${filtered.length} matched` : `${filtered.length} ${filtered.length === 1 ? "job" : "jobs"}`}
                        </span>
                      </div>
                    ) : (
                      <p className={`${label} px-2 pb-2`}>
                        {totalMatches != null && search ? `${totalMatches} matches` : `${filtered.length} jobs loaded`}
                      </p>
                    )}
                    <ol className="space-y-0.5">{filtered.map((job, index) => <li key={job.id}>
                      <button type="button" onClick={() => jumpTo(job.id)} aria-current={activeId === job.id ? "true" : undefined} className={`flex w-full gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${activeId === job.id ? "bg-[var(--lime)]/30" : "hover:bg-[var(--paper)]"}`}>
                        <span className={`mt-0.5 font-mono text-[10px] font-bold ${activeId === job.id ? "text-[var(--accent-strong)]" : "text-[var(--muted)]"}`}>{String(index + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-[11px] font-semibold leading-4">{job.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted)]">
                            <span>{timeAgo(job.postedAt, now)}</span>
                            {job.status === "New" && <span className="inline-block size-1.5 rounded-full bg-[var(--accent)] align-middle" />}
                            {reactions.isFavorite(job.id) && <Star size={10} weight="fill" className="text-[#f59e0b] dark:text-[#fde047]" />}
                            {reactions.isLiked(job.id) && <Heart size={10} weight="fill" className="text-[#fb7185] dark:text-[#fda4af]" />}
                          </span>
                        </span>
                      </button>
                    </li>)}</ol>
                  </div>
                </nav>
                <div className="min-w-0">
                  <section className="space-y-4">{filtered.map((job, index) => <ErrorBoundary key={job.id} name="job-card" fallback={CardError} resetKey={job}><JobCard job={job} index={index} now={now} liked={reactions.isLiked(job.id)} favorite={reactions.isFavorite(job.id)} onLike={() => reactions.toggleLike(job.id, job)} onFavorite={() => reactions.toggleFavorite(job.id, job)} onOpen={() => openPreview(job.id)}
                    onUndo={job.status === "Applied" || job.status === "Rejected" ? () => jobStatus.undo(job) : undefined}
                    undoing={jobStatus.pendingId === job.id}
                    undoError={jobStatus.errorId === job.id ? jobStatus.error?.message || "Could not undo. Try again." : ""} /></ErrorBoundary>)}</section>
                  <div ref={loadMoreRef} className="flex min-h-24 items-center justify-center py-8" aria-live="polite">
                    {isFetchingNextPage ? <div className="flex items-center gap-3 text-xs font-semibold text-[var(--muted)]"><span className="size-4 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--lime-dark)]" />Loading more jobs</div>
                      : <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted)]">{hasNextPage ? "Scroll for more jobs" : "All jobs loaded"}</span>}
                  </div>
                </div>
              </div>
                : <section ref={loadMoreRef} className="py-24 text-center">
                  <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--ink)]/5">
                    {isFetchingNextPage || isFetching ? <span className="size-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--lime-dark)]" />
                      : favoritesOnly ? <Star size={24} weight="fill" className="text-[#f59e0b] dark:text-[#fde047]" />
                      : likedOnly ? <Heart size={24} weight="fill" className="text-[#fb7185] dark:text-[#fda4af]" />
                      : <Briefcase size={22} />}
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">
                    {noFavoritesYet ? "No favorite jobs yet"
                      : noLikedYet ? "No liked jobs yet"
                      : favoritesOnly || likedOnly ? "No saved jobs match these filters"
                      : hasNextPage || isFetching ? "Looking for matching jobs"
                      : "No matching jobs"}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {noFavoritesYet ? "Click the star icon on any job card to save it here for fast review."
                      : noLikedYet ? "Click the heart icon on any job card to save it to your liked jobs list."
                      : favoritesOnly || likedOnly ? "Try another status tab, skill or time window, or turn off Favorites or Liked."
                      : hasNextPage ? "Loading more results from the next page."
                      : search ? `Nothing matches “${search}”. Try another word.`
                      : "Try another skill, time window, or search term."}
                  </p>
                  {(favoritesOnly || likedOnly) && (
                    <button type="button" onClick={() => setReactionFilter(EMPTY_REACTION_FILTER)} className={`${primaryButton} mt-5`}>
                      Browse all jobs
                    </button>
                  )}
                </section>}
        </div>

        {preview && <JobDrawer job={preview} jobs={filtered} onSelect={(job) => openPreview(job.id)} onClose={closePreview} onApply={jobStatus.markApplied} applyError={jobStatus.errorId === preview.id ? `Could not mark this job as applied: ${jobStatus.error?.message || "please try again."}` : ""} />}
        {adding && <AddJobDialog onClose={() => setAdding(false)} />}
        {liveSearching && <LiveSearchDialog skillRecords={skillRecords} skillsLoading={skillsLoading || isFetchingMoreSkills} onClose={() => setLiveSearching(false)} />}
        {skillDialog && <OpportunityFilterDialog skills={skills} extraFilters={extraFilters} skillRecords={skillRecords} isLoading={skillsLoading || isFetchingMoreSkills} error={skillsError ? skillsQueryError : null} onClose={() => setSkillDialog(false)} onApply={({ skills: nextSkills, extraFilters: nextFilters }) => { setSkills(nextSkills); setExtraFilters(nextFilters); setSkillDialog(false); }} onRemove={({ skills: nextSkills, extraFilters: nextFilters }) => { setSkills(nextSkills); setExtraFilters(nextFilters); }} />}
      </main>
    </Shell>
  );
}
