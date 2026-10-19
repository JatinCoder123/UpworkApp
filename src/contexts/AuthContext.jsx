import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { consumeLoginIntro, endSession, fetchSessionUser, startMicrosoftLogin } from "../lib/auth";
import { fetchUserRole, findGatewayUserIdByEmail, saveUserRole } from "../services/api";
import { isAdminUser, needsRole } from "../lib/roles";

const AuthContext = createContext(null);

// Adds the user's role (the "Role" field on their CRM Users record) and admin flag.
// If the CRM cannot be reached, `rolesChecked` stays false and the user sees every section instead of
// being locked out or sent to onboarding by mistake (see lib/roles).
async function withRoles(sessionUser) {
  const sessionAdmin = isAdminUser(sessionUser);
  try {
    const crmUserId = sessionUser.crmUserId || await findGatewayUserIdByEmail(sessionUser.email);
    const { role, isAdmin } = await fetchUserRole(crmUserId);
    return { ...sessionUser, crmUserId, roles: role ? [role.name] : [], isAdmin: sessionAdmin || isAdmin, rolesChecked: true };
  } catch (roleError) {
    console.warn("Could not load the user's role; showing every section.", roleError);
    return { ...sessionUser, isAdmin: sessionAdmin, rolesChecked: false };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [showLoginIntro, setShowLoginIntro] = useState(false);

  const refresh = useCallback(async (signal) => {
    setStatus("loading");
    setError("");
    try {
      const sessionUser = await fetchSessionUser({ signal });
      const fullUser = sessionUser ? await withRoles(sessionUser) : null;
      if (signal?.aborted) return;
      setUser(fullUser);
      setStatus(fullUser ? "authenticated" : "anonymous");
      if (fullUser && consumeLoginIntro()) setShowLoginIntro(true);
    } catch (sessionError) {
      if (sessionError.name === "AbortError") return;
      setUser(null);
      setStatus("error");
      setError(sessionError.message);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const logout = useCallback(async () => {
    await endSession();
    setShowLoginIntro(false);
    setUser(null);
    setStatus("anonymous");
  }, []);

  // First-login onboarding: saves the chosen role in the user's CRM "Role" field, then applies it straight away.
  // Only for a user who still needs a role; admins and users who already have one cannot set it from the app.
  const chooseRole = useCallback(async (role) => {
    if (!needsRole(user)) throw new Error("Your role is already set. Only an admin can change it.");
    const crmUserId = user?.crmUserId || await findGatewayUserIdByEmail(user?.email);
    const saved = await saveUserRole(crmUserId, role);
    setUser((current) => (current ? { ...current, crmUserId, roles: [saved.name], rolesChecked: true } : current));
  }, [user]);

  const completeLoginIntro = useCallback(() => setShowLoginIntro(false), []);
  const value = useMemo(() => ({ user, status, error, login: startMicrosoftLogin, logout, refresh, chooseRole, showLoginIntro, completeLoginIntro }), [user, status, error, logout, refresh, chooseRole, showLoginIntro, completeLoginIntro]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
