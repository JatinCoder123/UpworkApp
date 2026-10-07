import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import gsap from "gsap";
import { ArrowUpRight, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import { Mark, primaryButton } from "../components/ui";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../contexts/AuthContext";

function MicrosoftMark() {
  return <span aria-hidden="true" className="grid grid-cols-2 gap-px">
    <i className="size-2.5 bg-[#f35325]" /><i className="size-2.5 bg-[#81bc06]" />
    <i className="size-2.5 bg-[#05a6f0]" /><i className="size-2.5 bg-[#ffba08]" />
  </span>;
}

export default function Login() {
  const root = useRef(null);
  const { status, error, login } = useAuth();

  useEffect(() => {
    const ctx = gsap.context(() => gsap.fromTo("[data-enter]", { y: 38, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.05, stagger: .11, ease: "power4.out" }), root);
    return () => ctx.revert();
  }, []);

  if (status === "authenticated") return <Navigate to="/jobs" replace />;

  return <main ref={root} className="relative grid min-h-[100dvh] bg-[var(--ink)] text-white lg:grid-cols-[.92fr_1.08fr]">
    <div className="absolute right-6 top-6 z-20"><ThemeToggle inverted /></div>
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden px-5 py-6 sm:px-10 lg:px-14"><div className="pointer-events-none absolute -left-36 top-1/3 size-[28rem] rounded-full bg-[var(--lime)]/10 blur-[110px]" /><div data-enter className="flex items-center gap-3"><Mark dark /><span className="text-sm font-bold">UpWorkApp</span><span className="text-[10px] uppercase tracking-[.2em] text-white/55">Opportunity OS</span></div><div className="my-auto max-w-xl py-24"><div data-enter className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10"><Sparkle size={13} /><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/70">Your pursuit, organized</span></div><h1 data-enter className="max-w-lg text-[clamp(3rem,7vw,6.8rem)] font-medium leading-[.86] tracking-[-.075em]">Win work<br />worth <span className="font-serif italic text-[var(--lime)]">doing.</span></h1><p data-enter className="mt-8 max-w-md text-sm leading-7 text-white/60">A considered command center for finding, shaping, and winning your next best Upwork opportunity.</p></div><div data-enter className="flex items-end justify-between border-t border-white/10 pt-5 text-[10px] uppercase tracking-[.16em] text-white/50"><span>Built for focused teams</span><span>© 2026</span></div></section>
    <section className="relative m-2 flex min-h-[calc(100dvh-1rem)] items-end overflow-hidden rounded-[2rem] p-5 sm:p-10 lg:m-3 lg:p-14"><img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=88" className="absolute inset-0 size-full object-cover" alt="Creative team collaborating" /><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" /><div data-enter className="relative w-full rounded-[2rem] bg-[var(--surface)] p-2 text-[var(--ink)] shadow-[0_40px_100px_rgba(0,0,0,.25)] sm:max-w-[29rem]"><div className="rounded-[calc(2rem-.5rem)] bg-white px-5 py-7 sm:px-8 sm:py-10"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">Welcome back</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em]">Enter your workspace</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Sign in with your approved Microsoft work account.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-[#f5d6cf] px-4 py-3 text-xs font-semibold text-[var(--danger)]">{error}</p>}
      <button type="button" onClick={login} disabled={status === "loading"} className={`${primaryButton} mt-7 w-full bg-[var(--lime)] !text-[var(--ink)] disabled:cursor-wait disabled:opacity-60`}><MicrosoftMark /><span>{status === "loading" ? "Checking session…" : "Continue with Microsoft"}</span><span className="ml-auto grid size-8 place-items-center rounded-full bg-[var(--ink)] text-white"><ArrowUpRight size={15} /></span></button>
      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--paper)] p-4"><ShieldCheck className="mt-0.5 shrink-0 text-[var(--lime-dark)]" size={19} weight="fill" /><p className="text-[11px] leading-5 text-[var(--muted)]">Access is limited to approved accounts. Authentication is handled securely by Microsoft; your password is never shared with UpWorkApp.</p></div>
    </div></div></section>
  </main>;
}
