/* Small fetch wrapper for the app's own API (same origin, cookies sent automatically). */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public body?: unknown) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; raw?: BodyInit; contentType?: string } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method || (opts.body !== undefined || opts.raw ? "POST" : "GET"), credentials: "same-origin", headers: {} };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  } else if (opts.raw) {
    init.body = opts.raw;
    (init.headers as Record<string, string>)["Content-Type"] = opts.contentType || "application/octet-stream";
  }
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, "offline", "You seem to be offline. Check your connection and try again.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = (data || {}) as { error?: string; message?: string };
    throw new ApiError(res.status, d.error || "error", d.message || "Something went wrong.", data);
  }
  return data as T;
}
