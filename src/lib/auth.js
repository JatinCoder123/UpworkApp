// Auth and domain API backend, from VITE_AUTH_BASE_URL in .env.
export const AUTH_ORIGIN = String(import.meta.env.VITE_AUTH_BASE_URL || "").replace(/\/$/, "");
if (!AUTH_ORIGIN) console.error("VITE_AUTH_BASE_URL is not set. Add it to .env (see .env.example); sign-in will not work without it.");
const LOGIN_INTRO_KEY = "outrightfeedportal-login-intro";

export function startMicrosoftLogin() {
  try {
    sessionStorage.setItem(LOGIN_INTRO_KEY, "pending");
  } catch {
    /* storage blocked: skip the intro */
  }
  window.location.assign(`${AUTH_ORIGIN}/`);
}

export function consumeLoginIntro() {
  try {
    const pending = sessionStorage.getItem(LOGIN_INTRO_KEY) === "pending";
    if (pending) sessionStorage.removeItem(LOGIN_INTRO_KEY);
    return pending;
  } catch {
    return false;
  }
}

export async function fetchSessionUser({ signal } = {}) {
  const response = await fetch(`${AUTH_ORIGIN}/api/auth/me`, {
    credentials: "include",
    signal,
  });

  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Unable to verify your session. Please try again.");

  const data = await response.json();
  return data?.authenticated && data?.user && typeof data.user === "object" ? data.user : null;
}

export async function endSession() {
  const response = await fetch(`${AUTH_ORIGIN}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok && response.status !== 401) {
    throw new Error("Unable to sign out. Please try again.");
  }
}

export function userInitials(name) {
  return String(name || "User").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
