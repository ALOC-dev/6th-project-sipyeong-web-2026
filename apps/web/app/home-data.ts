import { loadAccount } from "./academic-account";
import { api } from "./api-client";

export const requirementStatus = {
  met: "충족", expected: "충족 예정", unmet: "미충족", unknown: "추가 확인 필요",
} as const;

export const requirementUnits = { credits: "학점", courses: "과목", hours: "시간" } as const;

export interface GraduationRequirement {
  code: string;
  title: string;
  type: string;
  status: keyof typeof requirementStatus;
  pendingReason?: "manual_review" | "language_score_missing" | null;
  unit: keyof typeof requirementUnits | null;
  currentValue: number | null;
  projectedValue: number | null;
  requiredValue: number | null;
  remaining: number | null;
  missingCourses: { course_id: number; course_name: string }[];
  enrolledCourses: { course_id: number; course_name: string }[];
}

export interface Graduation {
  status: keyof typeof requirementStatus;
  requirementSet: { requirement_set_id: number; source_ref: string } | null;
  counts: { total: number; met: number; expected: number };
  requirements: GraduationRequirement[];
}

export interface HomeOverview {
  currentTerm: { year: number; termCode: "10" | "20" };
  gpa: { overall: number | null; major: number | null; basis: { gpaCredits: number; gradePoints: number } | null };
  calendar: { academicTerm: HomeOverview["currentTerm"]; opensOn?: string; classesEndOn?: string; sourceUrl?: string };
  credits: { earned: number | null; recognized: number | null };
  currentSemester: { courseCount: number; credits: number };
  semesterGpas: { year: number; termCode: string; gpa: number | null }[];
  graduation: Graduation;
}

export async function loadHome(signal: AbortSignal) {
  const account = await loadAccount(signal);
  if (!account.me.profileCompleted) return { account, overview: null };
  const { data: overview } = await api<HomeOverview>("me/summary", { signal });
  return { account, overview };
}

export const regularTerm = (code: "10" | "20") => code === "10" ? 1 : 2;

export const requirementProgress = (value: number | null, required: number | null) =>
  value !== null && required !== null && required > 0 ? Math.min(100, value / required * 100) : 0;

export function requirementLabel(rule: GraduationRequirement) {
  if (rule.pendingReason === "manual_review") return "수동 확인 필요";
  if (rule.pendingReason === "language_score_missing") return "어학성적 미등록";
  if (rule.status === "unmet" && rule.remaining !== null && rule.unit) return `${rule.remaining}${requirementUnits[rule.unit]} 남음`;
  return requirementStatus[rule.status];
}

export function getHomeSemesters(overview: HomeOverview, admissionYear: number, lastSemester?: string, target?: number) {
  const termOrder: Record<string, number> = { "10": 0, SUMMER: 1, "20": 2, WINTER: 3 };
  const currentKey = `${overview.currentTerm.year}/${overview.currentTerm.termCode}`;
  const records = new Map(overview.semesterGpas.map(row => [`${row.year}/${row.termCode}`, row]));
  const [lastYear, lastTerm] = (lastSemester ?? "").split("-").map(Number);
  const currentOrder = overview.currentTerm.year * 2 + regularTerm(overview.currentTerm.termCode) - 1;
  const finalOrder = Math.max(currentOrder, lastYear ? lastYear * 2 + lastTerm - 1 : currentOrder);
  const firstOrder = Math.min(admissionYear * 2, currentOrder);
  for (let order = firstOrder; order <= finalOrder; order++) {
    const year = Math.floor(order / 2);
    const termCode = order % 2 === 0 ? "10" : "20";
    const key = `${year}/${termCode}`;
    if (!records.has(key)) records.set(key, { year, termCode, gpa: null });
  }
  return [...records.entries()]
    .sort(([, a], [, b]) => a.year - b.year || (termOrder[a.termCode] ?? 4) - (termOrder[b.termCode] ?? 4))
    .map(([id, row]) => ({
      id,
      label: id === currentKey ? "지금" :
        `${row.year} ${row.termCode === "10" ? "1학기" : row.termCode === "20" ? "2학기" :
          row.termCode === "SUMMER" ? "여름" : row.termCode === "WINTER" ? "겨울" : row.termCode}`,
      current: id === currentKey,
      gpa: id === currentKey && row.gpa === null && overview.currentSemester.credits > 0 ? target ?? null : row.gpa,
    }));
}
