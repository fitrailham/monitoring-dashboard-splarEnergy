import Dashboard from "./pages/PortfolioDashboard";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LANGUAGE_STORAGE_KEY, syncLanguageFromStorage } from "./i18n/language";
import { useLanguage } from "./i18n/useLanguage";
import LoginPage from "./pages/LoginPage";
import { getSession, signIn, signOut } from "./services/auth";
import type { Session } from "./services/auth";
import { ApiError, invalidatePendingSessionRequests, onSessionExpired } from "./services/http";
import { DASHBOARD_REFRESH_MS } from "./services/dashboard";

function AuthenticatedDashboard({ session, onLogout }: { session: Session; onLogout: () => Promise<void> }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: {
      staleTime: DASHBOARD_REFRESH_MS,
      gcTime: 0,
      retry: (attempt, error) => attempt < 1 &&
        (!(error instanceof ApiError) || error.status === 409 || error.status >= 500),
    } },
  }));
  return <QueryClientProvider client={client}><Dashboard session={session} onLogout={onLogout} /></QueryClientProvider>;
}

function App() {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>();
  const [notice, setNotice] = useState("");
  useEffect(() => {
    syncLanguageFromStorage();
    const sync = (event: StorageEvent) => { if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) syncLanguageFromStorage(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void getSession(controller.signal).then((restored) => {
      if (!controller.signal.aborted) setSession(restored);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setNotice(error instanceof Error ? error.message : "The backend could not be reached. Check the backend service and API configuration.");
      setSession(null);
    });
    return () => controller.abort();
  }, []);
  useEffect(() => onSessionExpired(() => {
    setNotice("Your session has expired. Sign in again.");
    setSession(null);
  }), []);
  useEffect(() => {
    if (session === undefined) return;
    const normalizeRoute = () => {
      const path = session ? "/" : "/login";
      if (window.location.pathname !== path) window.history.replaceState(null, "", path);
    };
    normalizeRoute();
    window.addEventListener("popstate", normalizeRoute);
    return () => window.removeEventListener("popstate", normalizeRoute);
  }, [session]);

  async function handleLogin(username: string, password: string) {
    const authenticated = await signIn(username, password);
    invalidatePendingSessionRequests();
    setNotice("");
    setSession(authenticated);
  }

  async function handleLogout() {
    if (!session) return;
    await signOut(session.csrfToken);
    invalidatePendingSessionRequests();
    setNotice("");
    setSession(null);
  }

  if (session === undefined) return <main className="map-loading" role="status">{t("Checking session…")}</main>;
  return session
    ? <AuthenticatedDashboard session={session} onLogout={handleLogout} />
    : <LoginPage onLogin={handleLogin} notice={notice} />;
}

export default App;
