import { mockApi } from './mock-api';

// Unset = frontend-only build: requests are answered in the browser by mock-api.
export const API_URL: string | undefined = import.meta.env.VITE_API_BASE_URL;
export const SOCKET_URL: string | undefined = import.meta.env.VITE_SOCKET_URL;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
) {
  if (!API_URL) return mockApi<T>(path, init);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      signal: init.signal,
      // X-Requested-With is required by the server's CSRF check.
      headers: {
        'X-Requested-With': 'fetch',
        ...(init.body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? 'UNKNOWN', e?.message ?? res.statusText, e?.details);
  }
  return data as T;
}
