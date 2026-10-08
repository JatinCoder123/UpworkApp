import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import {
  BookmarkSimple,
  Briefcase,
  Funnel,
  ListBullets,
  MagnifyingGlass,
  Plus,
  Rows,
  SquaresFour,
  X,
} from "@phosphor-icons/react";
import Shell from "../components/Shell";
import JobCard from "../components/JobCard";
import LogoLoader from "../components/LogoLoader";
import {
  AddJobDialog,
  DateFilterDialog,
  SaveViewDialog,
} from "../components/dialogs";
import { iconButton, primaryButton } from "../components/ui";
import { api } from "../services/api";
import { loadJobLayout, loadJobStatus, loadSavedViews, saveJobLayout, saveJobStatus, saveViews } from "../lib/preferences";

const pipeline = ["New", "Most recent", "Applied", "Rejected"];
const layouts = [
  { id: "grid", label: "Grid", icon: SquaresFour },
  { id: "list", label: "List", icon: ListBullets },
  { id: "compact", label: "Compact", icon: Rows },
];

const dateLabels = {
  all: "Any time",
  today: "Today",
  yesterday: "Yesterday",
  "7days": "Last 7 days",
  "30days": "Last 30 days",
  lastMonth: "Last month",
  custom: "Custom time",
};

function isInsideDateFilter(postedAt, filter) {
  if (filter.preset === "all") return true;
  const posted = new Date(postedAt),
    now = new Date();
  let start,
    end = now;
  if (filter.preset === "today")
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter.preset === "yesterday") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - 1,
    );
  }
  if (filter.preset === "7days")
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (filter.preset === "30days")
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (filter.preset === "lastMonth") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (filter.preset === "custom") {
    start = new Date(filter.from);
    end = new Date(filter.to);
  }
  return posted >= start && posted <= end;
}

export default function Jobs() {
  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["jobs"],
    queryFn: api.getJobs,
  });
  const [tab, setTab] = useState(() => loadJobStatus() === "Seen" ? "New" : loadJobStatus()),
    [layout, setLayout] = useState(loadJobLayout),
    [search, setSearch] = useState(""),
    [adding, setAdding] = useState(false),
    [skills, setSkills] = useState([]),
    [dateDialog, setDateDialog] = useState(false),
    [dateFilter, setDateFilter] = useState({ preset: "all", from: "", to: "" }),
    [savedViews, setSavedViews] = useState(loadSavedViews),
    [savingView, setSavingView] = useState(false);
  const root = useRef(null);
  const skillOptions = useMemo(
    () => [...new Set(jobs.flatMap((job) => job.tags))].sort(),
    [jobs],
  );
  const quickSkills = useMemo(
    () => [...new Set(jobs.flatMap((job) => job.tags))].slice(0, 3),
    [jobs],
  );
  const filtered = useMemo(
    () =>
      jobs.filter(
        (job) =>
          (tab === "New" ? ["New", "Seen"].includes(job.status) : tab === "Most recent" ? true : job.status === tab) &&
          `${job.title} ${job.company} ${job.tags.join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (!skills.length ||
            skills.some((skill) => job.tags.includes(skill))) &&
          isInsideDateFilter(job.postedAt, dateFilter),
      ).sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt)),
    [jobs, tab, search, skills, dateFilter],
  );
  const toggleSkill = (skill) =>
    setSkills((current) =>
      current.includes(skill)
        ? current.filter((item) => item !== skill)
        : [...current, skill],
    );
  const storeView = (name) => {
    const next = [
      ...savedViews,
      { id: crypto.randomUUID(), name, tab, search, skills, dateFilter },
    ];
    setSavedViews(next);
    saveViews(next);
    setSavingView(false);
  };
  const applyView = (saved) => {
    const nextTab = saved.tab === "Seen" ? "New" : saved.tab;
    setTab(nextTab);
    saveJobStatus(nextTab);
    setSearch(saved.search);
    setSkills(saved.skills);
    setDateFilter(saved.dateFilter);
  };
  const removeView = (id) => {
    const next = savedViews.filter((saved) => saved.id !== id);
    setSavedViews(next);
    saveViews(next);
  };
  useEffect(() => {
    if (!isLoading) {
      const ctx = gsap.context(
        () =>
          gsap.fromTo(
            "[data-card]",
            { y: 28, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.75,
              stagger: 0.08,
              ease: "power3.out",
            },
          ),
        root,
      );
      return () => ctx.revert();
    }
  }, [tab, search, skills, dateFilter, layout, isLoading]);
  return (
    <Shell>
      <main
        ref={root}
        className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-14 sm:px-6 md:pt-20"
      >
        <section className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">
              <span className="h-px w-7 bg-[var(--ink)]/25" />
              Opportunity desk
            </div>
            <h1 className="max-w-4xl text-[clamp(2.75rem,5vw,5.5rem)] font-semibold leading-[.9] tracking-[-.065em]">
              The right work,
              <br />
              <span className="font-serif font-medium italic">in focus.</span>
            </h1>
          </div>
          <div className="lg:pb-2">
            <p className="max-w-xs text-sm leading-6 text-[var(--muted)]">
              A quiet place to qualify the signal, write with care, and move at
              the right moment.
            </p>
            <button
              onClick={() => setAdding(true)}
              className={`${primaryButton} mt-5`}
            >
              <span>Add opportunity</span>
              <span className="grid size-8 place-items-center rounded-full bg-white/10">
                <Plus size={15} />
              </span>
            </button>
          </div>
        </section>
        <section className="mt-12 rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70">
          <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] px-4 py-4 sm:px-6">
            {savedViews.length > 0 && (
              <div className="mb-4 flex items-center gap-2 overflow-x-auto border-b border-black/[.06] pb-4">
                <span className="mr-1 flex shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">
                  <BookmarkSimple size={13} />
                  Saved
                </span>
                {savedViews.map((saved) => (
                  <span
                    key={saved.id}
                    className="group flex shrink-0 items-center rounded-full bg-[var(--paper)]"
                  >
                    <button
                      onClick={() => applyView(saved)}
                      className="py-2 pl-3 pr-2 text-[10px] font-bold"
                    >
                      {saved.name}
                    </button>
                    <button
                      onClick={() => removeView(saved.id)}
                      aria-label={`Delete ${saved.name}`}
                      className="mr-1 grid size-6 place-items-center rounded-full text-[var(--muted)] opacity-60 hover:bg-black/5 hover:opacity-100"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex gap-1 overflow-x-auto rounded-full bg-[var(--paper)] p-1">
                {pipeline.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setTab(item);
                      saveJobStatus(item);
                    }}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${tab === item ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}
                  >
                    {item}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] ${tab === item ? "bg-white/12" : "bg-black/5"}`}
                    >
                      {item === "New" ? jobs.filter((job) => ["New", "Seen"].includes(job.status)).length : item === "Most recent" ? jobs.length : jobs.filter((job) => job.status === item).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full bg-[var(--paper)] p-1" aria-label="Job layout">
                  {layouts.map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" title={`${label} view`} aria-label={`${label} view`} aria-pressed={layout === id} onClick={() => { setLayout(id); saveJobLayout(id); }} className={`grid size-8 place-items-center rounded-full transition-all duration-300 ${layout === id ? "bg-[var(--raised)] text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>
                      <Icon size={15} weight={layout === id ? "fill" : "regular"} />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSavingView(true)}
                  className="grid size-10 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Save current view"
                >
                  <BookmarkSimple size={16} />
                </button>
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--paper)] px-4 py-2.5 md:w-64">
                  <MagnifyingGlass size={15} className="text-[var(--muted)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search opportunities"
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                  />
                </label>
                <button
                  onClick={() => setDateDialog(true)}
                  aria-label="Open all filters"
                  className={`${iconButton} ${dateFilter.preset !== "all" || skills.length ? "bg-[var(--lime)] !text-[#26320b] ring-2 ring-[var(--lime-dark)]/25" : ""}`}
                >
                  <Funnel size={16} />
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[.06] pt-4">
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">
                Skills
              </span>
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                {quickSkills.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    aria-pressed={skills.includes(skill)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${skills.includes(skill) ? "bg-[var(--lime)] !text-[#26320b] ring-1 ring-[var(--lime-dark)]/30" : "bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]"}`}
                  >
                    {skill}
                  </button>
                ))}
                <button
                  onClick={() => setDateDialog(true)}
                  className="shrink-0 rounded-full bg-transparent px-3 py-1.5 text-[10px] font-bold text-[var(--muted)] ring-1 ring-black/10 hover:text-[var(--ink)]"
                >
                  + More skills
                </button>
              </div>
              {dateFilter.preset !== "all" && (
                <button
                  onClick={() => setDateDialog(true)}
                  className="shrink-0 rounded-full bg-[#e1efbd] px-3 py-1.5 text-[10px] font-bold text-[#34420f]"
                >
                  {dateLabels[dateFilter.preset]}
                </button>
              )}
              {(skills.length > 0 || dateFilter.preset !== "all") && (
                <button
                  onClick={() => {
                    setSkills([]);
                    setDateFilter({ preset: "all", from: "", to: "" });
                  }}
                  className="shrink-0 text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </section>
        {isLoading ? (
          <LogoLoader className="min-h-[38dvh]" label="Loading opportunities" />
        ) : isError ? (
          <section className="py-24 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--danger)]/10">
              <Briefcase size={22} />
            </div>
            <h3 className="mt-5 text-xl font-semibold">Could not load opportunities</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--muted)]">
              {error?.response?.status === 401
                ? "The service rejected the request. Please sign in again or contact your administrator."
                : error?.message || "Check the connection and try again."}
            </p>
            <button onClick={() => refetch()} className={`${primaryButton} mt-5`}>
              Try again
            </button>
          </section>
        ) : filtered.length ? (
          <section className={`mt-6 grid gap-4 ${layout === "grid" ? "md:grid-cols-2 xl:grid-cols-3" : layout === "compact" ? "sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1"}`}>
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} layout={layout} />
            ))}
          </section>
        ) : (
          <section className="py-24 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--ink)]/5">
              <Briefcase size={22} />
            </div>
            <h3 className="mt-5 text-xl font-semibold">
              No matching opportunities
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Try another skill, time window, or search term.
            </p>
          </section>
        )}
        {adding && <AddJobDialog onClose={() => setAdding(false)} />}
        {dateDialog && (
          <DateFilterDialog
            value={dateFilter}
            skills={skills}
            skillOptions={skillOptions}
            onClose={() => setDateDialog(false)}
            onApply={({ date, skills: nextSkills }) => {
              setDateFilter(date);
              setSkills(nextSkills);
              setDateDialog(false);
            }}
          />
        )}
        {savingView && (
          <SaveViewDialog
            onClose={() => setSavingView(false)}
            onSave={storeView}
          />
        )}
      </main>
    </Shell>
  );
}
