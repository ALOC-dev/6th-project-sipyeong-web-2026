import { api, type Department, type Me } from "./api-client";

export interface CurriculumRule {
  departmentId: string;
  admissionYear: number;
  curriculumYear: number;
}

export async function loadAccount(signal: AbortSignal) {
  const me = await api<Me>("users/me", { signal });
  const departments = await api<{ items: Department[]; curriculumRules?: CurriculumRule[] }>("departments", { signal });
  return {
    me: me.data,
    departments: departments.data.items,
    curriculumRules: departments.data.curriculumRules ?? [],
    warnings: me.meta.warnings ?? [],
  };
}
