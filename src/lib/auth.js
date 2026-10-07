const AUTH_ORIGIN = "https://upworkapp.backend.outrightcrm.in".replace(/\/$/, "");
const LOGIN_INTRO_KEY = "upworkapp-login-intro";

export function startMicrosoftLogin() {
  sessionStorage.setItem(LOGIN_INTRO_KEY, "pending");
  window.location.assign(`${AUTH_ORIGIN}/`);
}

export function consumeLoginIntro() {
  const pending = sessionStorage.getItem(LOGIN_INTRO_KEY) === "pending";
  if (pending) sessionStorage.removeItem(LOGIN_INTRO_KEY);
  return pending;
}

export async function fetchSessionUser({ signal } = {}) {
  const response = await fetch(`${AUTH_ORIGIN}/api/auth/me`, {
    credentials: "include",
    signal,
  });

  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Unable to verify your session. Please try again.");

  const data = await response.json();
  return data?.authenticated && data?.user ? data.user : null;
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
