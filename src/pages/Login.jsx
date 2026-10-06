import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ArrowUpRight, Eye, EyeSlash, Info, Sparkle, X } from "@phosphor-icons/react";
import { Mark, primaryButton } from "../components/ui";
import ThemeToggle from "../components/ThemeToggle";
import { createSession, DEMO_PASSWORD, getSessionUser, isValidEmail } from "../lib/auth";

function ProviderButton({ provider, onClick, children }) {
  return <button type="button" onClick={() => onClick(provider)} className="flex items-center justify-center gap-2.5 rounded-2xl bg-[var(--paper)] px-3 py-3 text-xs font-bold text-[var(--ink)] ring-1 ring-black/5 transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 hover:bg-white">{children}<span>{provider}</span></button>;
}

export default function Login() {
  const navigate = useNavigate();
  const root = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const ctx = gsap.context(() => gsap.fromTo("[data-enter]", { y: 38, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.05, stagger: .11, ease: "power4.out" }), root);
    return () => ctx.revert();
  }, []);

  if (getSessionUser()) return <Navigate to="/jobs" replace />;

  const login = (event) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError("Enter a valid email address, for example name@company.com.");
      return;
    }
    if (password !== DEMO_PASSWORD) {
      setError("That password is incorrect. Please try again.");
      return;
    }
    createSession(email);
    navigate("/jobs", { replace: true });
  };

  const showProviderNotice = (provider) => {
    setNotice(`${provider} authentication is under development. Please use email and password for now.`);
    window.setTimeout(() => setNotice(""), 5000);
  };

  return <main ref={root} className="relative grid min-h-[100dvh] bg-[var(--ink)] text-white lg:grid-cols-[.92fr_1.08fr]">
    {notice && <div role="status" className="fixed left-1/2 top-5 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl bg-white p-4 text-[var(--ink)] shadow-[0_24px_80px_rgba(0,0,0,.3)] ring-1 ring-black/5"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--lime)]"><Info size={17} weight="bold" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold">Coming soon</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{notice}</p></div><button type="button" onClick={() => setNotice("")} aria-label="Close notification" className="grid size-7 place-items-center rounded-full hover:bg-black/5"><X size={14} /></button></div>}
    <div className="absolute right-6 top-6 z-20"><ThemeToggle inverted /></div>
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden px-5 py-6 sm:px-10 lg:px-14"><div className="pointer-events-none absolute -left-36 top-1/3 size-[28rem] rounded-full bg-[var(--lime)]/10 blur-[110px]" /><div data-enter className="flex items-center gap-3"><Mark dark /><span className="text-sm font-bold">Pitchflow</span><span className="text-[10px] uppercase tracking-[.2em] text-white/55">Opportunity OS</span></div><div className="my-auto max-w-xl py-24"><div data-enter className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10"><Sparkle size={13} /><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/70">Your pursuit, organized</span></div><h1 data-enter className="max-w-lg text-[clamp(3rem,7vw,6.8rem)] font-medium leading-[.86] tracking-[-.075em]">Win work<br />worth <span className="font-serif italic text-[var(--lime)]">doing.</span></h1><p data-enter className="mt-8 max-w-md text-sm leading-7 text-white/60">A considered command center for finding, shaping, and winning your next best Upwork opportunity.</p></div><div data-enter className="flex items-end justify-between border-t border-white/10 pt-5 text-[10px] uppercase tracking-[.16em] text-white/50"><span>Built for focused teams</span><span>© 2026</span></div></section>
    <section className="relative m-2 flex min-h-[calc(100dvh-1rem)] items-end overflow-hidden rounded-[2rem] p-5 sm:p-10 lg:m-3 lg:p-14"><img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=88" className="absolute inset-0 size-full object-cover" alt="Creative team collaborating" /><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" /><div data-enter className="relative w-full rounded-[2rem] bg-[var(--surface)] p-2 text-[var(--ink)] shadow-[0_40px_100px_rgba(0,0,0,.25)] sm:max-w-[29rem]"><form onSubmit={login} noValidate className="rounded-[calc(2rem-.5rem)] bg-white px-5 py-6 sm:px-8 sm:py-9"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">Welcome back</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em]">Enter your workspace</h2><p className="mt-2 text-sm text-[var(--muted)]">Your best opportunities are waiting.</p>
      <div className="mt-7 grid grid-cols-2 gap-2"><ProviderButton provider="Google" onClick={showProviderNotice}><span className="text-base font-bold text-[#4285f4]">G</span></ProviderButton><ProviderButton provider="Microsoft" onClick={showProviderNotice}><span className="grid grid-cols-2 gap-px"><i className="size-2 bg-[#f35325]" /><i className="size-2 bg-[#81bc06]" /><i className="size-2 bg-[#05a6f0]" /><i className="size-2 bg-[#ffba08]" /></span></ProviderButton></div><div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-black/[.08]" /><span className="text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">or continue with email</span><span className="h-px flex-1 bg-black/[.08]" /></div>
      <label className="block text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="name@company.com" className="mt-2.5 h-14 w-full rounded-2xl bg-[var(--paper)] px-5 text-base font-normal normal-case tracking-normal outline-none ring-1 ring-black/10 transition-shadow focus:ring-2 focus:ring-[var(--lime-dark)]" /></label>
      <label className="mt-6 block text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">Password<span className="relative mt-2.5 block"><input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Enter your password" className="h-14 w-full rounded-2xl bg-[var(--paper)] pl-5 pr-14 text-base font-normal normal-case tracking-normal outline-none ring-1 ring-black/10 transition-shadow focus:ring-2 focus:ring-[var(--lime-dark)]" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-black/5 hover:text-[var(--ink)]">{showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}</button></span></label>
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#f5d6cf] px-4 py-3 text-xs font-semibold text-[var(--danger)]">{error}</p>}
      <button className={`${primaryButton} mt-7 w-full bg-[var(--lime)] !text-[var(--ink)]`}><span>Open workspace</span><span className="ml-auto grid size-8 place-items-center rounded-full bg-[var(--ink)] text-white"><ArrowUpRight size={15} /></span></button><p className="mt-5 text-center text-[11px] text-[var(--muted)]">Use any valid email · Password: upwork@123</p></form></div></section>
  </main>;
}
