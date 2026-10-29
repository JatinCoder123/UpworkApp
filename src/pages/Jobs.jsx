import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { BookmarkSimple, Briefcase, Broadcast, CaretDown, CaretRight, Check, ClockCounterClockwise, Fire, Funnel, GearSix, Heart, MagnifyingGlass, Plus, SlidersHorizontal, X } from "@phosphor-icons/react";
import Shell from "../components/Shell";
import JobCard from "../components/JobCard";
import JobDrawer from "../components/JobDrawer";
import JobAlerts from "../components/JobAlerts";
import { SortMenu } from "../components/JobListControls";
import LogoLoader from "../components/LogoLoader";
import HScroll from "../components/HScroll";
import { AddJobDialog } from "../components/dialogs";
import DateTimeRangeFilter from "../components/DateTimeRangeFilter";
import OpportunityFilterDialog from "../components/OpportunityFilterDialog";
import JobPreferencesDialog from "../components/JobPreferencesDialog";
import MySkillsDialog from "../components/MySkillsDialog";
import LiveSearchDialog from "../components/LiveSearchDialog";
import { ActiveDateFilterChip, RefreshFilterButton } from "../components/FilterToolbarControls";
import { iconButton, primaryButton } from "../components/ui";
import { api } from "../services/api";
import { EMPTY_EXTRA_FILTERS, EMPTY_REACTION_FILTER, JOB_SORTS, loadDateFilter, loadExtraFilters, loadJobScope, loadJobSort, loadJobStatus, loadMySkillsFilter, loadReactionFilter, saveDateFilter, saveExtraFilters, saveJobScope, saveJobSort, saveJobStatus, saveMySkillsFilter, saveReactionFilter } from "../lib/preferences";
import { EMPTY_DATE_RANGE, toGatewayDateFilter } from "../lib/dateRange";
import { clientLocation, countExtraFilters, forgetSearch, loadRecentSearches, matchesExtraFilters, rememberSearch, skillStyle, usePreviewParam } from "../lib/jobSignals";
import { useCrmReactions } from "../lib/crmReactions";
import { useJobStatus } from "../lib/jobStatus";
import ErrorBoundary, { CardError } from "../components/ErrorBoundary";
import { timeAgo, useNow } from "../lib/time";
import { useAuth } from "../contexts/AuthContext";
import { asArray, asObject, asText } from "../lib/safe";

const scopes = ["My Jobs", "All Jobs"];
const pipeline = ["New", "Applied", "Rejected"];
// The first tabs show in the row; the rest sit under "More".
const mainTabs = pipeline.slice(0, 2);
const moreTabs = pipeline.slice(2);
// "New" covers New and Seen, which the gateway cannot OR together, so only the other tabs filter on the server.
const serverStatus = (tab) => (tab === "Applied" || tab === "Rejected" ? tab : "");
const label = "text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]";
const SKILL_GROUP_KEY = "pitchflow-skill-group";
const EMPTY_SKILL_GROUP = { category: "", subcategory: "" };
const EMPTY_GROUP_OPTIONS = { category: [], subcategory: [] };
// First copy of each id, in order: the same result as filter + findIndex, in one pass.
const uniqueById = (records) => { const seen = new Set(); return records.filter((record) => { const id = record?.id; if (seen.has(id)) return false; seen.add(id); return true; }); };
const isDropdownKey = (value) => typeof value === "string" && /^[a-z0-9_]+$/.test(value);

// The last category / sub category the user picked (CRM dropdown keys; "" = all). Anything else saved is ignored.
function loadSkillGroup() {
  try {
    const saved = JSON.parse(localStorage.getItem(SKILL_GROUP_KEY) || "null");
    const category = isDropdownKey(saved?.category) ? saved.category : "";
    return { category, subcategory: category && isDropdownKey(saved?.subcategory) ? saved.subcategory : "" };
  } catch {
    return EMPTY_SKILL_GROUP;
  }
}
const searchShortcut = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K";

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Underlined status tab; `count` shows as a badge, lime when the tab is active.
function StatusTab({ active, onClick, count, ariaProps, children }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} {...ariaProps} className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors duration-300 ${active ? "border-[var(--text)] text-[var(--text)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`}>
    {children}
    {count != null && <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${active ? "bg-[var(--lime)] !text-[#26320b]" : "bg-[var(--paper)] text-[var(--muted)]"}`}>{count}</span>}
  </button>;
}

// The job's own engagement flag when it was fetched with one, otherwise the user's id list.

function FilterChip({ children, onClear }) {
  return <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lime)]/35 px-3 py-1.5 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/25">
    {children}
    <button type="button" onClick={onClear} aria-label={`Remove ${children} filter`} className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10"><X size={11} /></button>
  </span>;
}

export default function Jobs() {
  const { user, can } = useAuth();
  const now = useNow();
  const reactions = useCrmReactions(user);
  const jobStatus = useJobStatus();
  const [dateFilter, setDateFilter] = useState(() => loadDateFilter("jobs"));
  const gatewayDateFilter = useMemo(() => toGatewayDateFilter(dateFilter, "date_entered", { utc: true }), [dateFilter]);
  const [scope, setScope] = useState(loadJobScope);
  const [tab, setTab] = useState(() => (loadJobStatus() === "Seen" ? "New" : loadJobStatus()));
  // Independent of the status tab, so e.g. Rejected + Saved + Liked narrow the list together.
  const [reactionFilter, setReactionFilter] = useState(loadReactionFilter);
  // The Applied tab lists every applied job on its own: Saved / Liked stay selected but do not narrow it.
  const reactionsApply = tab !== "Applied";
  const savedOnly = reactionFilter.saved && reactionsApply;
  const likedOnly = reactionFilter.liked && reactionsApply;
  const reactionView = savedOnly || likedOnly;
  const [mySkillsOpen, setMySkillsOpen] = useState(false);
  const [mySkillsChecked, setMySkillsChecked] = useState(loadMySkillsFilter);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 450);
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches(user?.email));
  const [skills, setSkills] = useState([]);
  // Skills section path: category -> sub category -> skill -> jobs. The choices are the CRM jobs dropdowns and
  // every step is filtered by the smart gateway. Remembered like the other filters.
  const [skillGroup, setSkillGroup] = useState(loadSkillGroup);
  useEffect(() => { try { localStorage.setItem(SKILL_GROUP_KEY, JSON.stringify(skillGroup)); } catch { /* storage unavailable */ } }, [skillGroup]);
  const { category: jobCategory, subcategory: jobSubcategory } = skillGroup;
  // With exactly one skill picked the gateway filters by it; two or more are matched on the loaded pages.
  const serverSkill = skills.length === 1 ? skills[0] : "";
  const [adding, setAdding] = useState(false);
  const [liveSearching, setLiveSearching] = useState(false);
  const [skillDialog, setSkillDialog] = useState(false);
  // "My preferences" checkbox: saved in the CRM per user (user_check on the user's preference records), so it is the
  // same in every browser. The click shows at once; the saved value takes over once the CRM confirms it.
  const [preferenceToggle, setPreferenceToggle] = useState(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [sort, setSort] = useState(loadJobSort);
  const [extraFilters, setExtraFilters] = useState(() => loadExtraFilters("jobs"));
  const { previewId, openPreview, closePreview } = usePreviewParam();
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const [moreTabsOpen, setMoreTabsOpen] = useState(false);
  const moreTabsRef = useRef(null);
  const showAllJobs = scope === "All Jobs";
  const status = serverStatus(tab);
  const order = JOB_SORTS.find((item) => item.id === sort) || JOB_SORTS[0];

  const queryClient = useQueryClient();
  // The Applied tab lists only the jobs this user applied to (with when), whatever the My / All Jobs scope.
  // Shared with the tab count below through the ["my-applied", ...] cache entry.
  const myAppliedQuery = (withSearch) => {
    const params = { userEmail: user?.email, dateFilter: gatewayDateFilter, search: withSearch ? search : "", category: jobCategory, subcategory: jobSubcategory, skill: serverSkill };
    return { queryKey: ["my-applied", params], queryFn: () => api.getMyAppliedJobs(params) };
  };
  // My skills (picked with the gear, ticked / unticked with the checkbox): while ticked, the jobs shown are the ones
  // linked to the user's skills in the CRM, and so are the counts (the gateway still filters, searches, sorts and pages
  // them). Like Saved and Liked, the Applied tab is the exception: it lists every job the user applied to. Unticked,
  // with no skills yet, or if the skills cannot be read, every job shows.
  const { data: mySkillsData, isError: mySkillsFailed } = useQuery({ queryKey: ["my-skills", user?.email], queryFn: () => api.getMySkills(user.email), enabled: Boolean(user?.email), staleTime: 5 * 60_000 });
  const mySkills = useMemo(() => asArray(mySkillsData), [mySkillsData]);
  // The jobs linked to these skills in the CRM (outr_skills <-> outr_upwork_jobs).
  const mySkillIds = useMemo(() => mySkills.map((skill) => skill.id), [mySkills]);
  // Still on while the skills load, so the unfiltered list never flashes in first.
  const skillsOn = mySkillsChecked && !mySkillsFailed && (!mySkillsData || mySkills.length > 0);
  const skillsApply = skillsOn && reactionsApply;
  const { data: skillJobIds, isError: skillJobsFailed } = useQuery({ queryKey: ["my-skill-jobs", mySkillIds], queryFn: () => api.getSkillJobIds(mySkillIds), enabled: skillsOn && mySkillIds.length > 0, staleTime: 5 * 60_000 });
  // The jobs linked to the user's skills (none without skills); null until known.
  const skillJobs = !skillsOn || skillJobsFailed ? null : mySkillIds.length ? skillJobIds ?? null : mySkillsData ? [] : null;
  const skillJobsReady = !skillsOn || skillJobsFailed || skillJobs !== null;
  const jobIds = skillsApply && !skillJobsFailed ? skillJobs : null;
  const statsJobIds = skillsOn && !skillJobsFailed ? skillJobs : null;
  const waitingForSkills = skillsApply && !skillJobsReady;
  const { data: jobPages, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, isError, error, refetch } = useInfiniteQuery({
    queryKey: ["jobs", status === "Applied" ? "mine" : showAllJobs ? "all" : user?.email, gatewayDateFilter, search, status, order.orderBy, order.orderDir, jobCategory, jobSubcategory, serverSkill, jobIds],
    queryFn: ({ pageParam }) => status === "Applied" ? queryClient.fetchQuery(myAppliedQuery(true)) : api.getJobsPage({ page: pageParam, perPage: 20, dateFilter: gatewayDateFilter, userEmail: user.email, allJobs: showAllJobs, search, status, orderBy: order.orderBy, orderDir: order.orderDir, category: jobCategory, subcategory: jobSubcategory, skill: serverSkill, jobIds }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    enabled: Boolean(user?.email) && !waitingForSkills,
    placeholderData: (previous) => previous,
  });
  const totalMatches = jobPages?.pages?.[0]?.total;
  const { data: jobStatsData, isFetching: isFetchingStats, refetch: refetchStats } = useQuery({
    queryKey: ["job-stats", user?.email, gatewayDateFilter, jobCategory, jobSubcategory, serverSkill, statsJobIds],
    queryFn: () => api.getJobStats({ dateFilter: gatewayDateFilter, userEmail: user.email, category: jobCategory, subcategory: jobSubcategory, skill: serverSkill, jobIds: statsJobIds }),
    enabled: Boolean(user?.email) && skillJobsReady,
    placeholderData: (previous) => previous,
  });
  const jobStats = asObject(jobStatsData);
  // Applied count: the jobs this user applied to, with the same filters as the other tab counts (not the search).
  const { data: myAppliedData } = useQuery({ ...myAppliedQuery(false), enabled: Boolean(user?.email), placeholderData: (previous) => previous });
  const scopePrefix = showAllJobs ? "all" : "my";
  const scopeCounts = { "My Jobs": jobStats.my_total, "All Jobs": jobStats.all_total };
  const pipelineCounts = {
    New: (jobStats[`${scopePrefix}_new`] || 0) + (jobStats[`${scopePrefix}_seen`] || 0),
    Applied: myAppliedData?.total,
    Rejected: jobStats[`${scopePrefix}_rejected`],
  };
  const { data: skillPages, isLoading: skillsLoading, isError: skillsError, error: skillsQueryError, hasNextPage: hasMoreSkills, isFetchingNextPage: isFetchingMoreSkills, fetchNextPage: fetchMoreSkills } = useInfiniteQuery({
    queryKey: ["skills"],
    // 50 per page (the gateway maximum): all skills arrive in 2 requests instead of 3 one after another.
    queryFn: ({ pageParam }) => api.getSkills({ page: pageParam, perPage: 50 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    // Only loaded when something shows it: the skill chips (Department and Role picked), the filters or Live search.
    enabled: Boolean(jobCategory && jobSubcategory) || Boolean(skillDialog) || liveSearching,
  });
  const root = useRef(null);
  const loadMoreRef = useRef(null);

  useEffect(() => saveDateFilter("jobs", dateFilter), [dateFilter]);
  useEffect(() => saveExtraFilters("jobs", extraFilters), [extraFilters]);
  useEffect(() => saveReactionFilter(reactionFilter), [reactionFilter]);
  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);
  useEffect(() => {
    if (!moreTabsOpen) return undefined;
    const dismiss = (event) => { if (!moreTabsRef.current?.contains(event.target)) setMoreTabsOpen(false); };
    const closeOnEscape = (event) => { if (event.key === "Escape") setMoreTabsOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", closeOnEscape); };
  }, [moreTabsOpen]);
  useEffect(() => {
    if (hasMoreSkills && !isFetchingMoreSkills) fetchMoreSkills();
  }, [fetchMoreSkills, hasMoreSkills, isFetchingMoreSkills]);
  const skillRecords = useMemo(
    () => uniqueById(asArray(skillPages?.pages).flatMap((page) => asArray(page?.records))).sort((a, b) => asText(a.name).localeCompare(asText(b.name))),
    [skillPages],
  );
  // Category / sub category choices: the outr_skills dropdown_lists (the same keys the jobs use), with job counts from get_stats.
  const { data: groupOptionsData } = useQuery({ queryKey: ["skills", "group-options"], queryFn: () => api.getGroupOptions(), staleTime: 10 * 60_000 });
  const groupOptions = groupOptionsData || EMPTY_GROUP_OPTIONS;
  const { data: groupCounts } = useQuery({
    queryKey: ["job-group-counts", showAllJobs ? "all" : user?.email, gatewayDateFilter, jobCategory, groupOptions],
    queryFn: () => api.getJobGroupCounts({ options: groupOptions, dateFilter: gatewayDateFilter, userEmail: user.email, allJobs: showAllJobs, category: jobCategory }),
    enabled: Boolean(user?.email) && groupOptions.category.length + groupOptions.subcategory.length > 0,
    placeholderData: (previous) => previous,
  });
  // Skills section steps: category -> sub category -> that sub category's skills, all from the gateway.
  const groupChosen = Boolean(jobCategory || jobSubcategory);
  const skillsReady = Boolean(jobCategory && jobSubcategory);
  const { data: groupSkillRecords, isLoading: groupSkillsLoading } = useQuery({
    queryKey: ["skills", "group", jobCategory, jobSubcategory],
    queryFn: () => api.getSkillsInGroup({ category: jobCategory, subcategory: jobSubcategory }),
    enabled: skillsReady,
    placeholderData: (previous) => previous,
  });
  // Job counts per skill follow the scope and date window, like the pipeline counts. Only the chips shown are counted
  // (that Role's skills and any picked ones), and only once a Role is picked.
  const countedSkillNames = useMemo(
    () => (skillsReady ? [...new Set([...asArray(groupSkillRecords).map((record) => record.name), ...skills])].filter(Boolean).sort() : []),
    [skillsReady, groupSkillRecords, skills],
  );
  const { data: skillCountsData, isFetching: isFetchingSkillCounts, refetch: refetchSkillCounts } = useQuery({
    queryKey: ["skill-counts", showAllJobs ? "all" : user?.email, gatewayDateFilter, countedSkillNames, jobCategory, jobSubcategory],
    queryFn: () => api.getSkillCounts({ skills: countedSkillNames, dateFilter: gatewayDateFilter, userEmail: user.email, allJobs: showAllJobs, category: jobCategory, subcategory: jobSubcategory }),
    enabled: Boolean(user?.email) && countedSkillNames.length > 0,
    placeholderData: (previous) => previous,
  });
  const skillCounts = asObject(skillCountsData);
  // Most jobs first; ties and not-yet-counted skills stay alphabetical.
  const rankedSkillRecords = useMemo(
    () => [...skillRecords].sort((a, b) => (skillCounts[b.name] ?? -1) - (skillCounts[a.name] ?? -1) || asText(a.name).localeCompare(asText(b.name))),
    [skillRecords, skillCounts],
  );
  // Every sub category in the CRM dropdown is offered, each with its job count.
  const subcategoryOptions = groupOptions.subcategory;
  // Chips appear once a sub category is picked. Skills already picked stay so they can still be removed.
  const visibleSkillRecords = useMemo(() => {
    const inGroup = new Set(skillsReady ? asArray(groupSkillRecords).map((record) => record.id) : []);
    return rankedSkillRecords.filter((record) => skills.includes(record.name) || inGroup.has(record.id));
  }, [skillsReady, groupSkillRecords, rankedSkillRecords, skills]);

  // With Saved or Liked on, the user's jobs from the CRM are shown even when they are outside the loaded pages.
  const loadedJobs = useMemo(() => uniqueById(asArray(jobPages?.pages).flatMap((page) => asArray(page?.records))), [jobPages]);
  const reactionIds = useMemo(
    () => [...new Set([...(savedOnly ? reactions.saved : []), ...(likedOnly ? reactions.liked : [])])],
    [savedOnly, likedOnly, reactions.saved, reactions.liked],
  );
  // With a category picked only the gateway-filtered pages are used, so jobs from other categories never come in.
  // With a category or My skills on, only the gateway-filtered pages are used, so other jobs never come in.
  const missingReactionIds = groupChosen || skillsApply ? [] : reactionIds.filter((id) => !loadedJobs.some((job) => job.id === id));
  const reactionJobQueries = useQueries({
    queries: missingReactionIds.map((id) => ({ queryKey: ["job", id], queryFn: () => api.getJob(id, user?.email), retry: false, staleTime: 60_000 })),
  });
  const reactionJobs = reactionJobQueries.map((query) => query.data).filter((job) => job?.id);
  const reactionJobsKey = reactionJobs.map((job) => `${job.id}:${job.status}`).join("|");
  // The user's feed preferences (CRM, outr_user_preferences) and the jobs that match them (any age, New / Seen),
  // both through the gateway. Used on the New and All tabs of the plain list (not Saved / Liked).
  const { data: preferenceData } = useQuery({ queryKey: ["my-preferences", user?.email], queryFn: () => api.getMyPreferences(user.email), enabled: Boolean(user?.email), staleTime: 5 * 60_000 });
  const preferences = useMemo(() => asArray(preferenceData?.records), [preferenceData]);
  const activePreferences = useMemo(() => preferences.filter((preference) => preference.active), [preferences]);
  const preferenceOptions = preferenceData?.options || EMPTY_GROUP_OPTIONS;
  // Ticked when any of the user's preference records has user_check on (ticked by default before any are saved).
  const savedToggle = preferences.length ? preferences.some((preference) => preference.userCheck) : true;
  const usePreferences = preferenceToggle ?? savedToggle;
  const setUsePreferences = async (enabled) => {
    setPreferenceToggle(enabled);
    try {
      await api.setMyPreferencesEnabled(preferences, enabled);
      await queryClient.invalidateQueries({ queryKey: ["my-preferences"] });
    } catch (error) {
      console.warn("Could not save the My preferences checkbox", error);
    } finally {
      setPreferenceToggle(null);
    }
  };
  const preferencesApply = usePreferences && activePreferences.length > 0 && (tab === "New" || tab === "All") && !reactionView;
  const { data: preferredJobsData } = useQuery({
    queryKey: ["preferred-jobs", showAllJobs ? "all" : user?.email, search, jobCategory, jobSubcategory, serverSkill, activePreferences],
    queryFn: () => api.getPreferredJobs({ userEmail: user.email, preferences: activePreferences, allJobs: showAllJobs, search, category: jobCategory, subcategory: jobSubcategory, skill: serverSkill }),
    enabled: Boolean(user?.email) && preferencesApply,
    placeholderData: (previous) => previous,
  });
  // Only the preference jobs that are also jobs for the user's skills.
  const preferredJobs = useMemo(() => {
    const allowed = Array.isArray(jobIds) ? new Set(jobIds) : null;
    return asArray(preferredJobsData).filter((job) => !allowed || allowed.has(job.id));
  }, [preferredJobsData, jobIds]);
  const hotJobsCount = preferredJobs.length;
  const allDisplayJobs = useMemo(() => {
    const loadedIds = new Set(loadedJobs.map((job) => job.id));
    const plain = [...loadedJobs, ...reactionJobs.filter((job) => !loadedIds.has(job.id))];
    if (!preferencesApply) return plain;
    // Preference jobs come first; every other job follows below in the list's own order. A job already loaded keeps its own copy.
    const labelOf = (list, value) => asArray(list).find((option) => option.value === value)?.label || "";
    const preferred = new Map(preferredJobs.map((job) => [job.id, job.preference]));
    const plainIds = new Set(plain.map((job) => job.id));
    const merged = [...plain, ...preferredJobs.filter((job) => !plainIds.has(job.id))].map((job) => {
      const preference = preferred.get(job.id);
      return preference ? { ...job, preference: { ...preference, label: preference.skillName || labelOf(preferenceOptions.category, preference.category) || "Any skill" } } : job;
    });
    const postedTime = (job) => { const time = new Date(job.postedAt).getTime(); return Number.isFinite(time) ? time : 0; };
    // Preference jobs first, highest AI score first (newest first on a tie); the rest keep the list's own order.
    const mine = merged.filter((job) => job.preference).sort((a, b) => (Number(b.match) || 0) - (Number(a.match) || 0) || postedTime(b) - postedTime(a));
    return [...mine, ...merged.filter((job) => !job.preference)];
    // reactionJobs is a new array each render; its key says when its contents change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedJobs, reactionJobsKey, preferencesApply, preferredJobs, preferenceOptions]);

  // A refreshed or shared ?job= link can point at a job outside the loaded pages; fetch that one on its own.
  const listedPreview = previewId ? allDisplayJobs.find((job) => job.id === previewId) : null;
  const { data: fetchedPreview, isError: previewMissing } = useQuery({
    queryKey: ["job", previewId],
    queryFn: () => api.getJob(previewId, user?.email),
    enabled: Boolean(previewId) && !listedPreview,
    retry: false,
  });
  const preview = listedPreview || (fetchedPreview?.id === previewId ? fetchedPreview : null);
  useEffect(() => { if (previewMissing) closePreview(); }, [previewMissing, closePreview]);

  // Text search runs on the gateway; status "New" (New + Seen), saved/liked and multi-skill selection are applied to the loaded pages.
  // Every active filter must match, so they all combine.
  const filtered = useMemo(
    () => allDisplayJobs.filter((job) => {
      // Saved / Liked show every such job whatever its status; the status tab only narrows the plain list.
      if (!savedOnly && !likedOnly) {
        if (tab === "New") {
          if (!["New", "Seen"].includes(job.status)) return false;
        } else if (tab !== "All") {
          if (job.status !== tab) return false;
        }
      }
      // Same check as the heart and bookmark, so un-liking or un-saving here drops the job on that click.
      if (savedOnly && !reactions.isSaved(job.id, job)) return false;
      if (likedOnly && !reactions.isLiked(job.id, job)) return false;
      return matchesExtraFilters(job, extraFilters) &&
        (!skills.length || skills.some((skill) => asArray(job.skills).some((jobSkill) => asText(jobSkill).toLowerCase() === skill.toLowerCase()) || `${job.title} ${job.description}`.toLowerCase().includes(skill.toLowerCase())));
    }),
    // Every like/save click updates reactions.saved / reactions.liked, so they stand in for isSaved / isLiked here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allDisplayJobs, tab, savedOnly, likedOnly, skills, extraFilters, reactions.saved, reactions.liked],
  );

  // Why each rejected job on screen was rejected (from the activity log), in one gateway request.
  const rejectedIds = useMemo(() => filtered.filter((job) => job.status === "Rejected").map((job) => job.id), [filtered]);
  const { data: rejectReasons } = useQuery({
    queryKey: ["reject-reasons", rejectedIds],
    queryFn: () => api.getRejectReasons(rejectedIds),
    enabled: rejectedIds.length > 0,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });

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
  const changeMySkills = (on) => { setMySkillsChecked(on); saveMySkillsFilter(on); };
  // Ticking My skills with none picked yet opens the picker; it turns on once some are saved.
  const toggleMySkills = (on) => (on && !mySkills.length ? setMySkillsOpen(true) : changeMySkills(on));
  const toggleReactionFilter = (key) => setReactionFilter((current) => ({ ...current, [key]: !current[key] }));
  const noSavedYet = savedOnly && !reactions.saved.length;
  const noLikedYet = likedOnly && !reactions.liked.length;
  const jumpTo = (id) => document.getElementById(`job-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  // The funnel dialog holds skills, job type and client location, so its badge counts all three.
  const filterCount = skills.length + countExtraFilters(extraFilters);
  const hasFilters = skills.length > 0 || groupChosen || dateFilter.preset !== "all" || searchInput || countExtraFilters(extraFilters) > 0 || savedOnly || likedOnly;
  const searching = isFetching && !isFetchingNextPage && searchInput.trim() === search;
  const clearAllFilters = () => { setSkills([]); setSkillGroup(EMPTY_SKILL_GROUP); setSearchInput(""); setDateFilter(EMPTY_DATE_RANGE); setExtraFilters(EMPTY_EXTRA_FILTERS); setReactionFilter(EMPTY_REACTION_FILTER); };
  // The "new jobs" alert: the list shows the jobs it counted (added since `since`, every status, newest first). The
  // filters that could hide one are cleared, and My skills / My preferences are off for this visit only (not saved),
  // so no job is hidden and no older preference job is added on top.
  const showNewJobs = (since) => {
    const minute = (time) => { const date = new Date(time); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
    clearAllFilters();
    setDateFilter({ preset: "custom", from: minute(since), to: minute(Date.now()) });
    setTab("All");
    saveJobStatus("All");
    changeSort("newest");
    setMySkillsChecked(false);
    setPreferenceToggle(false);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <Shell>
      <main ref={root} className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
        <section className="rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70">
          <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)]">
            {/* Row 1: title, search and the main actions. */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[var(--line)]/70 px-4 py-4 sm:px-6">
              <h1 className="flex shrink-0 items-baseline gap-2 text-2xl font-semibold tracking-[-.04em]">Jobs<span className="font-mono text-xs font-semibold tracking-normal text-[var(--muted)] tabular-nums">{isFetchingStats && scopeCounts[scope] == null ? "…" : scopeCounts[scope] ?? 0} total</span></h1>
              <form onSubmit={(event) => { event.preventDefault(); commitSearch(); setSearchFocused(false); }} className="job-search relative order-last flex w-full min-w-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-1.5 md:order-none md:w-auto md:max-w-xl md:flex-1">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-[#26320b] shadow-[0_2px_8px_color-mix(in_srgb,var(--lime-dark)_35%,transparent)]">
                  {searching ? <span className="size-4 animate-spin rounded-full border-2 border-[#26320b]/25 border-t-[#26320b]" aria-label="Searching" /> : <MagnifyingGlass size={15} weight="bold" />}
                </span>
                <input ref={searchRef} value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setSearchFocused(true); }} onFocus={() => setSearchFocused(true)} onBlur={() => { setSearchFocused(false); if (searchInput.trim()) commitSearch(); }} onKeyDown={(event) => event.key === "Escape" && (searchInput ? setSearchFocused(false) : event.currentTarget.blur())} placeholder="Search title, description, skills…" aria-label="Search jobs" aria-keyshortcuts="Control+K Meta+K" aria-expanded={searchFocused && searchHistory.length > 0} aria-controls="job-search-history" autoComplete="off" className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-[var(--muted)]" />
                {searchInput
                  ? <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSearchInput(""); searchRef.current?.focus(); }} aria-label="Clear search" className="grid size-7 shrink-0 place-items-center rounded-full bg-black/[.06] text-[var(--muted)] hover:bg-black/15 hover:text-[var(--ink)] dark:bg-white/10"><X size={12} weight="bold" /></button>
                  : <kbd className="hidden shrink-0 rounded-lg bg-[var(--surface)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] sm:inline-block">{searchShortcut}</kbd>}
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
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {/* Opens Live Jobs, so only for users with that permission. */}
                {can("Live Jobs") && <button type="button" onClick={() => setLiveSearching(true)} className="inline-flex items-center gap-2 rounded-full bg-[var(--lime)] px-4 py-2.5 text-xs font-bold !text-[#26320b] ring-1 ring-[var(--lime-dark)]/35 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(105,130,32,.22)]">
                  <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#3f5a12] opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-[#3f5a12]" /></span>
                  <Broadcast size={14} weight="bold" />Live search
                </button>}
                <button type="button" onClick={() => setAdding(true)} className={`${primaryButton} !py-2.5 !pl-4 !pr-5`}><Plus size={14} weight="bold" /><span>Add job</span></button>
              </div>
            </div>

            {/* Row 2: scope, status tabs and the list controls. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--line)]/70 px-4 sm:px-6">
              <div className="my-3 flex shrink-0 items-center gap-1 rounded-full bg-[var(--paper)] p-1" aria-label="Job scope">
                {scopes.map((item) => <button key={item} type="button" aria-pressed={scope === item} onClick={() => { setScope(item); saveJobScope(item); }} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-300 ${scope === item ? "bg-[var(--raised)] text-[var(--text)] shadow-sm ring-1 ring-[var(--line)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
                  {item}<span className="ml-1.5 font-mono text-[10px] tabular-nums text-[var(--muted)]">{isFetchingStats && scopeCounts[item] == null ? "…" : scopeCounts[item] ?? 0}</span>
                </button>)}
              </div>
              <span aria-hidden="true" className="hidden h-6 w-px bg-[var(--line)] sm:block" />
              <div role="tablist" aria-label="Job status" className="flex items-stretch gap-1 self-stretch">
                {mainTabs.map((item) => <StatusTab key={item} active={tab === item && !reactionView} onClick={() => changeTab(item)} count={isFetchingStats && pipelineCounts[item] == null ? "…" : pipelineCounts[item] ?? 0}>{item}</StatusTab>)}
                <div ref={moreTabsRef} className="relative flex">
                  {(() => {
                    const current = reactionView ? null : moreTabs.find((item) => item === tab);
                    return <StatusTab active={Boolean(current)} onClick={() => setMoreTabsOpen((open) => !open)} count={current ? (pipelineCounts[current] ?? 0) : null} ariaProps={{ "aria-haspopup": "menu", "aria-expanded": moreTabsOpen }}>
                      {current || "More"}<CaretDown size={12} weight="bold" className={`transition-transform ${moreTabsOpen ? "rotate-180" : ""}`} />
                    </StatusTab>;
                  })()}
                  {moreTabsOpen && <div className="absolute left-0 top-[calc(100%-.25rem)] z-50 w-52 rounded-[1.4rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgba(30,32,25,.2)] ring-1 ring-black/5">
                    <div role="menu" aria-label="More statuses" className="rounded-[calc(1.4rem-.375rem)] bg-[var(--surface)] p-2">
                      {moreTabs.map((item) => <button key={item} type="button" role="menuitem" onClick={() => { changeTab(item); setMoreTabsOpen(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${tab === item ? "bg-[var(--lime)] !text-[#26320b]" : "text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"}`}>
                        {item}<span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] tabular-nums dark:bg-white/10">{pipelineCounts[item] ?? 0}</span>
                      </button>)}
                    </div>
                  </div>}
                </div>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2 py-3">
                <SortMenu value={sort} options={JOB_SORTS} onChange={changeSort} />
                <DateTimeRangeFilter value={dateFilter} onApply={setDateFilter} label="Job posting time" />
                <button type="button" onClick={() => setSkillDialog(true)} aria-label="Open job filters" title="Filters" className={`relative ${iconButton} ${filterCount ? "bg-[var(--lime)] !text-[#26320b] ring-2 ring-[var(--lime-dark)]/40" : ""}`}>
                  <Funnel size={16} weight={filterCount ? "fill" : "regular"} />
                  {filterCount > 0 && <span className="absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full bg-[var(--text)] text-[9px] font-bold text-[var(--paper)] ring-2 ring-[var(--surface)]">{filterCount}</span>}
                </button>
                <RefreshFilterButton onClick={() => { refetch(); refetchStats(); if (countedSkillNames.length) refetchSkillCounts(); }} loading={isFetching || isFetchingStats || isFetchingSkillCounts} label="Refresh jobs" />
              </div>
            </div>

            {/* Row 3: liked, saved and skills, with Clear and the skill settings at the end. */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-6 lg:flex-nowrap">
              <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
                <button type="button" aria-pressed={likedOnly} onClick={() => toggleReactionFilter("liked")} title={reactionsApply ? "Show liked jobs" : "Not used on the Applied tab, which shows every applied job"} disabled={!reactionsApply} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold ring-1 transition-all duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-45 ${likedOnly ? "bg-[#ffe4e6] text-[#e11d48] ring-[#fecdd3] shadow-sm dark:bg-[#fda4af]/20 dark:text-[#fda4af] dark:ring-[#fda4af]/40" : "bg-[var(--surface)] text-[var(--ink)] ring-[var(--line)] hover:ring-[#fecdd3]"}`}>
                  <Heart size={14} weight={likedOnly || reactions.liked.length > 0 ? "fill" : "regular"} className={likedOnly || reactions.liked.length > 0 ? "text-[#fb7185] dark:text-[#fda4af]" : "text-[#e11d48]"} />Liked
                  {reactions.liked.length > 0 && <span className={`font-mono text-[10px] tabular-nums ${likedOnly ? "opacity-75" : "text-[var(--muted)]"}`}>{reactions.liked.length}</span>}
                </button>
                <button type="button" aria-pressed={savedOnly} onClick={() => toggleReactionFilter("saved")} title={reactionsApply ? "Show saved jobs" : "Not used on the Applied tab, which shows every applied job"} disabled={!reactionsApply} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold ring-1 transition-all duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-45 ${savedOnly ? "bg-[#e0f2fe] text-[#0369a1] ring-[#bae6fd] shadow-sm dark:bg-[#7dd3fc]/20 dark:text-[#7dd3fc] dark:ring-[#7dd3fc]/40" : "bg-[var(--surface)] text-[var(--ink)] ring-[var(--line)] hover:ring-[#bae6fd]"}`}>
                  <BookmarkSimple size={14} weight={savedOnly || reactions.saved.length > 0 ? "fill" : "regular"} className={savedOnly || reactions.saved.length > 0 ? "text-[#0284c7] dark:text-[#7dd3fc]" : "text-[#0369a1]"} />Saved
                  {reactions.saved.length > 0 && <span className={`font-mono text-[10px] tabular-nums ${savedOnly ? "opacity-75" : "text-[var(--muted)]"}`}>{reactions.saved.length}</span>}
                </button>
                {/* My preferences: ticked, matching jobs come first; the gear edits them (saved in the CRM). */}
                <span className={`inline-flex shrink-0 items-center rounded-full ring-1 transition-colors ${usePreferences && activePreferences.length ? "bg-(--lime)/35 ring-[var(--lime-dark)]/40" : "bg-[var(--surface)] ring-[var(--line)]"}`}>
                  <label className="inline-flex cursor-pointer items-center gap-2 py-2 pl-3.5 pr-2 text-xs font-semibold text-[var(--ink)]" title={activePreferences.length ? "Show jobs that match my preferences first" : "No active preferences yet: use the gear to add one"}>
                    <input type="checkbox" checked={usePreferences} onChange={(event) => setUsePreferences(event.target.checked)} className="size-3.5 accent-[var(--lime-dark)]" />
                    My preferences
                  </label>
                  {/* How many hot jobs (matching the preferences) are at the top of the list. */}
                  {preferencesApply && preferredJobsData && <span title={`${hotJobsCount} hot job${hotJobsCount === 1 ? "" : "s"} match your preferences`} className="mr-0.5 inline-flex items-center gap-1 rounded-full bg-[#fff1e6] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#c2410c] ring-1 ring-[#fed7aa] dark:bg-[#3b1d0e] dark:text-[#fdba74] dark:ring-[#7c2d12]"><Fire size={10} weight="fill" className="text-[#f97316]" />{hotJobsCount}</span>}
                  <button type="button" onClick={() => setPreferencesOpen(true)} aria-label="Edit my preferences" title="Edit my preferences" className="mr-1 grid size-7 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-black/5 hover:text-[var(--ink)] dark:hover:bg-white/10"><GearSix size={14} weight="bold" /></button>
                </span>
                {/* My skills: ticked, only the jobs for the user's skills show; the gear picks the skills (saved in the CRM).
                    Ticking it with no skills yet opens the picker. */}
                <span className={`inline-flex shrink-0 items-center rounded-full ring-1 transition-colors ${skillsOn && mySkills.length ? "bg-(--lime)/35 ring-[var(--lime-dark)]/40" : "bg-[var(--surface)] ring-[var(--line)]"}`}>
                  <label className="inline-flex cursor-pointer items-center gap-2 py-2 pl-3.5 pr-2 text-xs font-semibold text-[var(--ink)]" title={mySkills.length ? `Show only the jobs for my skills: ${mySkills.map((skill) => skill.name).join(", ")}` : "No skills yet: tick to pick yours"}>
                    <input type="checkbox" checked={mySkillsChecked && mySkills.length > 0} onChange={(event) => toggleMySkills(event.target.checked)} className="size-3.5 accent-[var(--lime-dark)]" />
                    My skills
                  </label>
                  {mySkills.length > 0 && <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 font-mono text-[10px] tabular-nums text-[var(--muted)] ring-1 ring-[var(--line)]">{mySkills.length}</span>}
                  <button type="button" onClick={() => setMySkillsOpen(true)} aria-label="Edit my skills" title="Pick my skills" className="mx-1 grid size-7 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-black/5 hover:text-[var(--ink)] dark:hover:bg-white/10"><GearSix size={14} weight="bold" /></button>
                </span>
              </div>
              <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-[var(--line)] sm:block" />
              {/* Skills: Department (CRM category) -> Role (CRM sub category) -> that role's skills. The gateway filters each step. */}
              <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 lg:basis-0 lg:flex-nowrap">
                <span className={`${label} shrink-0`}>Skills</span>
                <FilterSelect
                  label="Department"
                  value={jobCategory}
                  placeholder="Department"
                  options={groupOptions.category.map((option) => [option.value, withCount(option.label, groupCounts?.category?.[option.value])])}
                  onChange={(category) => setSkillGroup({ category, subcategory: "" })}
                />
                {jobCategory && <>
                  <CaretRight size={11} weight="bold" aria-hidden="true" className="hidden shrink-0 text-[var(--muted)] sm:block" />
                  <FilterSelect
                    label="Role"
                    value={jobSubcategory}
                    placeholder="Role"
                    options={subcategoryOptions.map((option) => [option.value, withCount(option.label, groupCounts?.subcategory?.[option.value])])}
                    onChange={(subcategory) => setSkillGroup((current) => ({ ...current, subcategory }))}
                  />
                </>}
                {skillsReady && <CaretRight size={11} weight="bold" aria-hidden="true" className="hidden shrink-0 text-[var(--muted)] lg:block" />}
                <HScroll className="min-w-0 flex-1 basis-full lg:basis-0" innerClassName="gap-1.5" label="skills">
                  {/* Step 3: the skills of that sub category, most jobs first. */}
                  {skillsReady && visibleSkillRecords.map(({ id, name }) => {
                    const selected = skills.includes(name);
                    const count = skillCounts[name];
                    return <button key={id} type="button" onClick={() => toggleSkill(name)} aria-pressed={selected} style={skillStyle(name)} className="skill-chip inline-flex shrink-0 items-center gap-1 rounded-full py-1.5 pl-3 pr-1.5 text-[11px] font-semibold transition-transform duration-300 hover:-translate-y-0.5">
                      {selected && <Check size={11} weight="bold" />}{name}
                      <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${selected ? "bg-white/20 dark:bg-black/15" : "bg-black/5 dark:bg-white/10"}`}>{count == null ? "…" : count}</span>
                    </button>;
                  })}
                  {skillsReady && (skillsLoading || groupSkillsLoading) && <span className="skeleton-bone h-7 w-40 shrink-0 rounded-full" />}
                  {/* Skills picked earlier (or in the filter panel) still filter the list; shown so they are never hidden. */}
                  {!skillsReady && skills.length > 0 && <SkillCrumb label={skills.length === 1 ? skills[0] : `${skills.length} skills`} onClear={() => setSkills([])} />}
                </HScroll>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-3">
                {hasFilters && <button type="button" onClick={clearAllFilters} className="text-xs font-semibold text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--lime-dark)]">Clear</button>}
                <button type="button" onClick={() => setSkillDialog("skills")} aria-label="Filter by skill" title="Filter by skill" className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors duration-300 hover:bg-[var(--paper)] hover:text-[var(--ink)]"><SlidersHorizontal size={17} weight="bold" /></button>
              </div>
            </div>

            {/* Filters set in the funnel or date picker, so it is clear why the list is narrower. */}
            {(countExtraFilters(extraFilters) > 0 || dateFilter.preset !== "all") && <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)]/70 px-4 py-3 sm:px-6">
              {extraFilters.jobType !== "any" && <FilterChip onClear={() => setExtraFilters({ ...extraFilters, jobType: "any" })}>{extraFilters.jobType === "hourly" ? "Hourly jobs" : "Fixed-price jobs"}</FilterChip>}
              {extraFilters.location !== "any" && <FilterChip onClear={() => setExtraFilters({ ...extraFilters, location: "any" })}>{`${clientLocation(extraFilters.location).label} clients`}</FilterChip>}
              <ActiveDateFilterChip value={dateFilter} onClear={() => setDateFilter(EMPTY_DATE_RANGE)} />
            </div>}
          </div>
        </section>

        <div className="mt-8">
          {isLoading || waitingForSkills ? <LogoLoader className="min-h-[38dvh]" label="Loading jobs" />
            : isError ? <section className="py-24 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--danger)]/10"><Briefcase size={22} /></div>
              <h3 className="mt-5 text-xl font-semibold">Could not load jobs</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--muted)]">{error?.message || "Check the connection and try again."}</p>
              <button type="button" onClick={() => refetch()} className={`${primaryButton} mt-5`}>Try again</button>
            </section>
              : filtered.length ? <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
                <nav aria-label="Jump to job" className="hidden lg:block">
                  <div className="sticky top-[calc(var(--shell-h)+1rem)] max-h-[calc(100dvh-var(--shell-h)-2rem)] overflow-y-auto overscroll-contain rounded-[1.5rem] bg-[var(--surface)] p-3 ring-1 ring-[var(--line)]/70 [scrollbar-width:thin]">
                    {savedOnly && !likedOnly ? (
                      <div className="mb-2 flex items-center justify-between border-b border-[var(--line)]/70 px-2 pb-2">
                        <p className={`${label} flex items-center gap-1.5 text-[#0369a1] dark:text-[#7dd3fc]`}>
                          <BookmarkSimple size={12} weight="fill" className="text-[#0284c7] dark:text-[#7dd3fc]" />
                          <span>Saved jobs</span>
                        </p>
                        <span className="rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#075985] ring-1 ring-[#bae6fd] dark:bg-[#7dd3fc]/15 dark:text-[#7dd3fc] dark:ring-[#7dd3fc]/30">
                          {search ? `${filtered.length} matched` : `${filtered.length} ${filtered.length === 1 ? "job" : "jobs"}`}
                        </span>
                      </div>
                    ) : likedOnly && !savedOnly ? (
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
                            {reactions.isLiked(job.id, job) && <Heart size={10} weight="fill" className="text-[#fb7185] dark:text-[#fda4af]" />}
                            {reactions.isSaved(job.id, job) && <BookmarkSimple size={10} weight="fill" className="text-[#0284c7] dark:text-[#7dd3fc]" />}
                          </span>
                        </span>
                      </button>
                    </li>)}</ol>
                  </div>
                </nav>
                <div className="min-w-0">
                  <section className="space-y-4">{filtered.map((job, index) => <ErrorBoundary key={job.id} name="job-card" fallback={CardError} resetKey={job}><JobCard job={job} index={index} now={now} rejectReason={asObject(rejectReasons)[job.id]} liked={reactions.isLiked(job.id, job)} saved={reactions.isSaved(job.id, job)} onLike={() => reactions.toggleLike(job.id, job)} onSave={() => reactions.toggleSave(job.id, job)} onOpen={() => openPreview(job.id)}
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
                      : savedOnly ? <BookmarkSimple size={24} weight="fill" className="text-[#0284c7] dark:text-[#7dd3fc]" />
                      : likedOnly ? <Heart size={24} weight="fill" className="text-[#fb7185] dark:text-[#fda4af]" />
                      : <Briefcase size={22} />}
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">
                    {noSavedYet ? "No saved jobs yet"
                      : noLikedYet ? "No liked jobs yet"
                      : savedOnly || likedOnly ? "No liked or saved jobs match these filters"
                      : skillsApply ? "No jobs for your skills match these filters"
                      : hasNextPage || isFetching ? "Looking for matching jobs"
                      : "No matching jobs"}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {noSavedYet ? "Click the bookmark icon on any job card to save it here for fast review."
                      : noLikedYet ? "Click the heart icon on any job card to save it to your liked jobs list."
                      : savedOnly || likedOnly ? "Try another status tab, skill or time window, or turn off Saved or Liked."
                      : skillsApply ? "Try another status tab, time window or search, or add more skills with My skills, or untick it."
                      : hasNextPage ? "Loading more results from the next page."
                      : search ? `Nothing matches “${search}”. Try another word.`
                      : "Try another skill, time window, or search term."}
                  </p>
                  {(savedOnly || likedOnly) && (
                    <button type="button" onClick={() => setReactionFilter(EMPTY_REACTION_FILTER)} className={`${primaryButton} mt-5`}>
                      Browse all jobs
                    </button>
                  )}
                </section>}
        </div>

        {/* Feeder and applications alerts as the page opens; an extra, so a failure there hides them and nothing else. */}
        <ErrorBoundary name="job-alerts" fallback={NoAlerts}><JobAlerts userEmail={user?.email} allJobs={showAllJobs} onShowNew={showNewJobs} /></ErrorBoundary>
        {preview && <JobDrawer job={preview} jobs={filtered} onSelect={(job) => openPreview(job.id)} onClose={closePreview} onApply={jobStatus.markApplied} applyError={jobStatus.errorId === preview.id ? `Could not mark this job as applied: ${jobStatus.error?.message || "please try again."}` : ""} />}
        {adding && <AddJobDialog onClose={() => setAdding(false)} />}
        {liveSearching && <LiveSearchDialog skillRecords={skillRecords} skillsLoading={skillsLoading || isFetchingMoreSkills} onClose={() => setLiveSearching(false)} />}
        {mySkillsOpen && <MySkillsDialog onClose={() => setMySkillsOpen(false)} onSaved={(saved) => saved.length && changeMySkills(true)} />}
        {preferencesOpen && <JobPreferencesDialog user={user} enabled={usePreferences} allJobs={showAllJobs} preferences={preferences} options={preferenceOptions} onClose={() => setPreferencesOpen(false)} />}
        {skillDialog && <OpportunityFilterDialog key={skillDialog} skillsOnly={skillDialog === "skills"} skills={skills} extraFilters={extraFilters} skillRecords={skillRecords} groupOptions={groupOptions} group={skillGroup} isLoading={skillsLoading || isFetchingMoreSkills} error={skillsError ? skillsQueryError : null} onClose={() => setSkillDialog(false)} onApply={({ skills: nextSkills, extraFilters: nextFilters, group }) => { setSkills(nextSkills); setExtraFilters(nextFilters); if (group) setSkillGroup(group); setSkillDialog(false); }} onRemove={({ skills: nextSkills, extraFilters: nextFilters }) => { setSkills(nextSkills); setExtraFilters(nextFilters); }} />}
      </main>
    </Shell>
  );
}

const withCount = (text, count) => (count == null ? text : `${text} (${count})`);
const NoAlerts = () => null;

// Pill-shaped dropdown for the category and sub category; the placeholder ("" value) means nothing picked.
function FilterSelect({ label, value, placeholder, options, onChange }) {
  const active = Boolean(value);
  return <label className="relative inline-flex shrink-0 items-center">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`h-9 max-w-[13rem] cursor-pointer appearance-none truncate rounded-full py-0 pl-3.5 pr-8 text-[13px] font-semibold outline-none ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--lime-dark)] ${active ? "bg-(--lime)/40 text-[var(--ink)] ring-[var(--lime-dark)]/40" : "bg-[var(--surface)] text-[var(--muted)] ring-[var(--line)] hover:ring-[var(--lime-dark)]/60"}`}
    >
      <option value="">{placeholder}</option>
      {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
    </select>
    <CaretDown size={12} weight="bold" className="pointer-events-none absolute right-3 text-[var(--muted)]" />
  </label>;
}

// A chip with x, for skills picked before a sub category was chosen (so that filter is never hidden).
function SkillCrumb({ label, onClear }) {
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-(--lime)/40 py-1 pl-3 pr-1 font-semibold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/40">
    {label}
    <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="grid size-5 place-items-center rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/15"><X size={10} weight="bold" /></button>
  </span>;
}
