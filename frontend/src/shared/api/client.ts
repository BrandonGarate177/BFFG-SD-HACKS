import { API_BASE } from "../config";

export class ApiUnavailable extends Error {}

/**
 * Thin fetch wrapper. Features own their own request/response types and
 * endpoint calls; this only handles transport and the failure taxonomy so
 * both features report outages identically.
 */
export async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiUnavailable(`No server at ${API_BASE}`);
  }
  if (res.status === 404) throw new ApiUnavailable(`Not found: ${path}`);
  if (!res.ok) throw new ApiUnavailable(`Server returned ${res.status}`);
  return res.json() as Promise<T>;
}

export async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`);
  } catch {
    throw new ApiUnavailable(`No server at ${API_BASE}`);
  }
  if (!res.ok) throw new ApiUnavailable(`Server returned ${res.status}`);
  return res.json() as Promise<T>;
}
