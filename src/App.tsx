import Dashboard from "./pages/PortfolioDashboard";
import { useEffect, useState } from "react";
import { LANGUAGE_STORAGE_KEY, syncLanguageFromStorage } from "./i18n/language";
import LoginPage from "./pages/LoginPage";
import { endPreviewSession, readPreviewSession, startPreviewSession } from "./services/previewSession";

function App() {
  const [session, setSession] = useState(readPreviewSession);
  useEffect(() => {
    syncLanguageFromStorage();
    const sync = (event: StorageEvent) => { if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) syncLanguageFromStorage(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    const normalizeRoute = () => {
      const path = session ? "/" : "/login";
      if (window.location.pathname !== path) window.history.replaceState(null, "", path);
    };
    normalizeRoute();
    window.addEventListener("popstate", normalizeRoute);
    return () => window.removeEventListener("popstate", normalizeRoute);
  }, [session]);
  return session ? <Dashboard displayName={session.displayName} onLogout={() => {
    endPreviewSession(); setSession(null);
  }} /> : <LoginPage onPreview={(displayName) => setSession(startPreviewSession(displayName))} />;
}

export default App;
