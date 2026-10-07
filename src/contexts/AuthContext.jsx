import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { consumeLoginIntro, endSession, fetchSessionUser, startMicrosoftLogin } from "../lib/auth";

const AuthContext = createContext(null);

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
      setUser(sessionUser);
      setStatus(sessionUser ? "authenticated" : "anonymous");
      if (sessionUser && consumeLoginIntro()) setShowLoginIntro(true);
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

  const completeLoginIntro = useCallback(() => setShowLoginIntro(false), []);
  const value = useMemo(() => ({ user, status, error, login: startMicrosoftLogin, logout, refresh, showLoginIntro, completeLoginIntro }), [user, status, error, logout, refresh, showLoginIntro, completeLoginIntro]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
