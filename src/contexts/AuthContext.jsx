import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { consumeLoginIntro, endSession, fetchSessionUser, startMicrosoftLogin } from "../lib/auth";
import { countUserSkills, findGatewayUserIdByEmail, saveUserRole } from "../services/api";
import { fetchPermissionCatalog, fetchUserAccess } from "../services/accessApi";
import { can as canUser, needsRole, roleOf } from "../lib/permissions";

const AuthContext = createContext(null);

// How often access is re-read while the app is open (on window focus), so admin changes arrive without a reload.
const ACCESS_SYNC_MS = 60_000;

/*
 * The signed-in user with their access: `role`, `isAdmin` and `permissions` (see lib/permissions).
 * /api/auth/me sends role and isAdmin today; once it also sends `permissions`, that list is used as is (not for admins:
 * an admin always holds every permission that exists in the CRM's Permissions module, so a deleted one disappears).
 * Until then the CRM is read through the smart gateway (role defaults + extra permissions, or everything for an admin).
 * If the CRM cannot be reached, `accessChecked` is false: only the pages open to everyone work and a notice is shown,
 * the user stays signed in and is never sent to onboarding by mistake.
 */
async function withAccess(sessionUser) {
  const sessionPermissions = Array.isArray(sessionUser.permissions) ? sessionUser.permissions : null;
  try {
    const crmUserId = sessionUser.crmUserId || await findGatewayUserIdByEmail(sessionUser.email);
    const access = await fetchUserAccess(crmUserId);
    const isAdmin = sessionUser.isAdmin === true || access.isAdmin;
    // An admin holds every permission that exists in the CRM (the Permissions module), whoever marks them admin and
    // whatever their role or session lists, so a permission deleted there leaves an admin's nav too.
    const adminPermissions = isAdmin ? (access.isAdmin ? access.permissions : (await fetchPermissionCatalog()).map((permission) => permission.name)) : null;
    // Whether the user has picked their skills (Users <-> Skills); without any, they pick them at login (onboarding).
    // If that cannot be read, nobody is held back.
    const skillCount = await countUserSkills(crmUserId).catch(() => null);
    return {
      ...sessionUser,
      crmUserId,
      role: access.role?.name || null,
      isAdmin,
      permissions: adminPermissions ?? sessionPermissions ?? access.permissions,
      accessChecked: true,
      skillsChecked: skillCount !== null,
      hasSkills: skillCount > 0,
    };
  } catch (accessError) {
    console.warn("Could not load the user's access from the CRM.", accessError);
    return { ...sessionUser, role: roleOf(sessionUser), isAdmin: sessionUser.isAdmin === true, permissions: sessionPermissions ?? [], accessChecked: false, skillsChecked: false };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [showLoginIntro, setShowLoginIntro] = useState(false);
  const lastSync = useRef(0);

  const refresh = useCallback(async (signal) => {
    setStatus("loading");
    setError("");
    try {
      const sessionUser = await fetchSessionUser({ signal });
      const fullUser = sessionUser ? await withAccess(sessionUser) : null;
      if (signal?.aborted) return;
      lastSync.current = Date.now();
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

  // Re-reads access in the background (no loading screen). A 401 signs the user out; other errors keep the current access.
  const syncAccess = useCallback(async ({ force = false } = {}) => {
    if (!force && Date.now() - lastSync.current < ACCESS_SYNC_MS) return;
    lastSync.current = Date.now();
    try {
      const sessionUser = await fetchSessionUser();
      if (!sessionUser) {
        setUser(null);
        setStatus("anonymous");
        return;
      }
      setUser(await withAccess(sessionUser));
    } catch {
      /* keep the current access; the next focus tries again */
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return undefined;
    const onFocus = () => syncAccess();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status, syncAccess]);

  const logout = useCallback(async () => {
    await endSession();
    setShowLoginIntro(false);
    setUser(null);
    setStatus("anonymous");
  }, []);

  // First-login onboarding: saves the chosen role in the user's CRM "Role" field, then loads the role's permissions.
  // Only for a user who still needs a role; admins and users who already have one cannot set it from the app.
  const chooseRole = useCallback(async (role) => {
    if (!needsRole(user)) throw new Error("Your role is already set. Only an admin can change it.");
    const crmUserId = user?.crmUserId || await findGatewayUserIdByEmail(user?.email);
    const saved = await saveUserRole(crmUserId, role);
    const access = await fetchUserAccess(crmUserId).catch(() => null);
    setUser((current) => (current ? {
      ...current,
      crmUserId,
      role: saved.name,
      permissions: Array.isArray(current.permissions) && !access ? current.permissions : access?.permissions || [],
      accessChecked: true,
    } : current));
  }, [user]);

  // After the user saved their skills (onboarding or My skills): they no longer need to pick them.
  const skillsSaved = useCallback(() => setUser((current) => (current ? { ...current, skillsChecked: true, hasSkills: true } : current)), []);

  // can("Jobs"): whether the signed-in user holds that permission (admins hold every permission).
  const can = useCallback((permission) => canUser(user, permission), [user]);

  const completeLoginIntro = useCallback(() => setShowLoginIntro(false), []);
  const value = useMemo(
    () => ({ user, status, error, can, login: startMicrosoftLogin, logout, refresh, syncAccess, chooseRole, skillsSaved, showLoginIntro, completeLoginIntro }),
    [user, status, error, can, logout, refresh, syncAccess, chooseRole, skillsSaved, showLoginIntro, completeLoginIntro],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
