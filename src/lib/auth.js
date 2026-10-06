const SESSION_KEY = "pitchflow-session";
export const DEMO_PASSWORD = "upwork@123";

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

export function nameFromEmail(email) {
  const localPart = email.split("@")[0] || "User";
  return localPart
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ") || "User";
}

export function createSession(email) {
  const user = { email: email.trim().toLowerCase(), name: nameFromEmail(email.trim()) };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export function getSessionUser() {
  try {
    const user = JSON.parse(localStorage.getItem(SESSION_KEY));
    return user?.email && user?.name ? user : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function userInitials(name) {
  return String(name || "User").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
