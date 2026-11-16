// Temporary navigation state for the frontend preview, not authentication.
// Replace this flow with a server-verified session when the auth API is ready.
export const PREVIEW_SESSION_KEY = "icongreen.preview.session";
export interface PreviewSession { mode: "preview"; displayName: string }
type PreviewStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): PreviewStorage | undefined {
  try { return typeof sessionStorage === "undefined" ? undefined : sessionStorage; }
  catch { return undefined; }
}
export function readPreviewSession(storage = browserStorage()): PreviewSession | null {
  try {
    const saved = storage?.getItem(PREVIEW_SESSION_KEY);
    if (!saved) return null;
    const value: unknown = JSON.parse(saved);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const session = value as Record<string, unknown>;
    if (session.mode !== "preview" || typeof session.displayName !== "string" || !session.displayName.trim() || session.displayName.length > 80) return null;
    return { mode: "preview", displayName: session.displayName.trim() };
  } catch { return null; }
}
export function startPreviewSession(displayName: string, storage = browserStorage()): PreviewSession {
  const name = displayName.trim();
  if (!name || name.length > 80) throw new Error("Enter a valid username.");
  const session: PreviewSession = { mode: "preview", displayName: name };
  try { storage?.setItem(PREVIEW_SESSION_KEY, JSON.stringify(session)); } catch { /* In-memory navigation still works. */ }
  return session;
}
export function endPreviewSession(storage = browserStorage()) {
  try { storage?.removeItem(PREVIEW_SESSION_KEY); } catch { /* App state is cleared even when storage is unavailable. */ }
}
