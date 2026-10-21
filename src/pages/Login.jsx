import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import gsap from "gsap";
import { ArrowUpRight, FileText, Globe, PencilSimpleLine, Plus, Rss, ShieldCheck, Stack, VideoCamera } from "@phosphor-icons/react";
import { Mark, primaryButton } from "../components/ui";
import ThemeToggle from "../components/ThemeToggle";
import GridPattern from "../components/GridPattern";
import { useAuth } from "../contexts/AuthContext";
import { homePath } from "../lib/permissions";
import SessionLoader from "../components/SessionLoader";

function MicrosoftMark() {
  return (
    <span aria-hidden="true" className="grid grid-cols-2 gap-px">
      <i className="size-2.5 bg-[#f35325]" />
      <i className="size-2.5 bg-[#81bc06]" />
      <i className="size-2.5 bg-[#05a6f0]" />
      <i className="size-2.5 bg-[#ffba08]" />
    </span>
  );
}

const highlights = [
  { icon: Rss, label: "Get live AI news" },
  { icon: Stack, label: "Get the latest projects" },
  { icon: PencilSimpleLine, label: "Customized content for your website" },
  { icon: Plus, label: "Add your custom feeds" },
  { icon: Globe, label: "Select and buy a domain" },
  { icon: FileText, label: "AI-generated cover letters", isNew: true },
  { icon: VideoCamera, label: "AI-generated videos", isNew: true },
];

export default function Login() {
  const root = useRef(null);
  const { status, error, login, user } = useAuth();

  // The entrance animation runs once the login screen is actually shown (not while the session is being checked).
  const showingLogin = status !== "loading" && status !== "authenticated";
  useEffect(() => {
    if (!showingLogin) return undefined;
    const ctx = gsap.context(
      () =>
        gsap.fromTo(
          "[data-enter]",
          { y: 38, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 1.05,
            stagger: 0.11,
            ease: "power4.out",
          },
        ),
      root,
    );
    return () => ctx.revert();
  }, [showingLogin]);

  // While the session is being checked, a signed-in user must not see the login screen flash before being sent on.
  if (status === "loading") return <SessionLoader />;
  if (status === "authenticated") return <Navigate to={homePath(user)} replace />;

  return (
    <main
      ref={root}
      className="relative grid min-h-[100dvh] bg-[var(--ink)] text-white lg:grid-cols-[.92fr_1.08fr]"
    >
      <GridPattern
        width={68}
        height={68}
        squares={[[1, 1], [3, 4], [6, 2], [9, 7], [13, 3]]}
        className="app-grid-pattern app-grid-pattern-login pointer-events-none absolute inset-0 z-0"
      />
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle inverted />
      </div>

      <section className="relative flex min-h-[100dvh] flex-col overflow-hidden px-5 py-6 sm:px-10 lg:px-14">
        <div className="pointer-events-none absolute -left-36 top-1/3 size-[28rem] rounded-full bg-[var(--lime)]/10 blur-[110px]" />
        <div data-enter className="flex items-center gap-3">
          <Mark />
          <span className="text-sm font-bold tracking-[-.02em]">Outright Feed Portal</span>
          <span className="hidden text-[10px] font-semibold uppercase tracking-[.18em] text-white/65 sm:inline">
            Get Your Live Feeds
          </span>
        </div>

        <div className="my-auto max-w-3xl py-16">
          <h1
            data-enter
            className="max-w-lg text-[clamp(3rem,7vw,6.8rem)] font-medium leading-[.86] tracking-[-.075em]"
          >
            AI-Powered
            <br />
            <span className="font-serif italic text-[var(--lime)]">LiveFeeds</span>
          </h1>

          <p data-enter className="mt-8 max-w-xl text-[15px] leading-7 text-white/55">
            News, projects, content and creative assets — generated and delivered by AI, the moment you need them.
          </p>

          <ul
            className="mt-8 grid gap-3 sm:grid-cols-2"
            aria-label="Platform features"
          >
            {highlights.map(({ icon: Icon, label, isNew }, index) => (
              <li
                key={label}
                className="login-feature-card flex min-w-0 items-center gap-3.5 rounded-2xl bg-white/[.035] p-3 pr-4 ring-1 ring-inset ring-white/[.08] backdrop-blur-sm transition-colors duration-300 hover:bg-white/[.06] hover:ring-[var(--lime)]/25"
                style={{ "--feature-delay": `${0.45 + index * 0.12}s` }}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--lime)]/[.07] text-[var(--lime)] ring-1 ring-inset ring-[var(--lime)]/30 shadow-[0_0_18px_rgba(200,232,117,.14)]">
                  <Icon size={19} />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-5 text-white/85">{label}</span>
                {isNew && <span className="shrink-0 rounded-md bg-[var(--lime)] px-2 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#1d2810]">New</span>}
              </li>
            ))}
          </ul>
        </div>

        <div
          data-enter
          className="flex items-end justify-between border-t border-white/10 pt-5 text-[10px] uppercase tracking-[.16em] text-white/50"
        >
          <span>Built for focused teams</span>
          <span>© 2026</span>
        </div>
      </section>

      <section className="relative m-2 flex min-h-[calc(100dvh-1rem)] items-end overflow-hidden rounded-[2rem] p-5 sm:p-10 lg:m-3 lg:p-14">
        <img
          src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=88"
          className="absolute inset-0 size-full object-cover"
          alt="Creative team collaborating"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
        <div
          data-enter
          className="relative w-full rounded-[2rem] bg-[var(--surface)] p-2 text-[var(--ink)] shadow-[0_40px_100px_rgba(0,0,0,.25)] sm:max-w-[29rem]"
        >
          <div className="rounded-[calc(2rem-.5rem)] bg-white px-5 py-7 sm:px-8 sm:py-10">
            {/* <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]"></p> */}
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.045em]">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Sign in with your approved Microsoft work account.
            </p>
            {error && (
              <p role="alert" className="mt-5 rounded-xl bg-[#f5d6cf] px-4 py-3 text-xs font-semibold text-[var(--danger)]">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={login}
              disabled={status === "loading"}
              className={`${primaryButton} mt-7 w-full bg-[var(--lime)] !text-[var(--ink)] disabled:cursor-wait disabled:opacity-60`}
            >
              <MicrosoftMark />
              <span>{status === "loading" ? "Checking session…" : "Continue with Microsoft"}</span>
              <span className="ml-auto grid size-8 place-items-center rounded-full bg-[var(--ink)] text-white">
                <ArrowUpRight size={15} />
              </span>
            </button>
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--paper)] p-4">
              <ShieldCheck className="mt-0.5 shrink-0 text-[var(--lime-dark)]" size={19} weight="fill" />
              <p className="text-[11px] leading-5 text-[var(--muted)]">
                Access is limited to approved accounts.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
