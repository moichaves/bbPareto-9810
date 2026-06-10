import { hc } from "hono/client";
import type { AppType } from "../../api";
import { getToken } from "./auth";

const client = hc<AppType>("/", {
  headers: () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});
export const api = client.api;

/** Wrapper de fetch que injeta Authorization automaticamente */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
