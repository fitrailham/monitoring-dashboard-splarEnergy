import { ApiError, request } from "./http.ts";

interface SessionResponse {
  user: { username: string; display_name: string; role: "admin" | "viewer" };
  csrf_token: string;
}

export interface Session {
  displayName: string;
  role: "admin" | "viewer";
  csrfToken: string;
}

export async function getSession(signal?: AbortSignal): Promise<Session | null> {
  try {
    const { data } = await request<SessionResponse>("/api/auth/me", signal);
    if (typeof data?.user?.username !== "string" || !data.user.username.trim() ||
      (data.user.role !== "admin" && data.user.role !== "viewer") ||
      typeof data.csrf_token !== "string" || !data.csrf_token.trim())
      throw new Error("The backend returned an invalid session.");
    return {
      displayName: (typeof data.user.display_name === "string" && data.user.display_name.trim()) || data.user.username,
      role: data.user.role,
      csrfToken: data.csrf_token,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function signIn(username: string, password: string, signal?: AbortSignal): Promise<Session> {
  const { data } = await request<{ csrf_token: string }>("/api/auth/csrf", signal);
  if (typeof data?.csrf_token !== "string" || !data.csrf_token.trim())
    throw new Error("The backend returned an invalid login token.");
  await request("/api/auth/login", signal, {
    method: "POST", csrfToken: data.csrf_token, body: { username: username.trim(), password },
  });
  const session = await getSession(signal);
  if (!session) throw new Error("The browser could not establish a backend session. Check the API address and cookie configuration.");
  return session;
}

export async function signOut(csrfToken: string, signal?: AbortSignal) {
  try {
    await request("/api/auth/logout", signal, { method: "POST", csrfToken });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
  }
}
