export const API_BASE = import.meta.env?.DEV ? "" :
  (import.meta.env?.VITE_API_URL?.trim() ?? (import.meta.env ? "" : "http://127.0.0.1:8000")).replace(/\/+$/, "");

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  detail?: string;
  configured?: boolean;
  total?: number;
  meta?: { is_partial?: boolean; warnings?: string[]; page?: number | null; total_pages?: number | null; snapshot_id?: string; generated_at?: string; date?: string | null; time_zone?: string | null };
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface Mutation {
  method: "POST" | "PATCH";
  csrfToken: string;
  body?: unknown;
}

const sessionExpiredListeners = new Set<() => void>();
let sessionVersion = 0;

export function invalidatePendingSessionRequests() {
  sessionVersion++;
}

export function onSessionExpired(listener: () => void) {
  sessionExpiredListeners.add(listener);
  return () => { sessionExpiredListeners.delete(listener); };
}

export async function request<T>(
  path: string,
  signal?: AbortSignal,
  mutation?: Mutation,
): Promise<ApiResponse<T>> {
  const version = sessionVersion;
  const timeout = AbortSignal.timeout(15000);
  const init: RequestInit = {
    credentials: "include",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  };
  if (mutation) {
    init.method = mutation.method;
    init.headers = { "X-CSRF-Token": mutation.csrfToken };
    if (mutation.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(mutation.body);
    }
  }

  let response: Response;
  try {
    response = await fetch(API_BASE + path, init);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("The backend could not be reached. Check the backend service and API configuration.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    if (response.status === 401 && !path.startsWith("/api/auth/") && version === sessionVersion && !signal?.aborted) {
      invalidatePendingSessionRequests();
      sessionExpiredListeners.forEach((listener) => listener());
    }
    const message = typeof result?.detail === "string" ? result.detail :
      typeof result?.message === "string" ? result.message : `API error (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return result;
}
