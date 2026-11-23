import { api, type Department, type Me } from "./api-client";

export async function loadAccount(signal: AbortSignal) {
  const me = await api<Me>("users/me", { signal });
  const departments = await api<{ items: Department[] }>("departments", { signal });
  return { me: me.data, departments: departments.data.items, warnings: me.meta.warnings ?? [] };
}
