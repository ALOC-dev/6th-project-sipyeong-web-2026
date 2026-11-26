export interface Warning {
  code: string;
  message: string;
}

interface Envelope<T> {
  data: T;
  meta: { nextCursor?: string | null; warnings?: Warning[] };
}

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, message: string) {
    super(message);
  }
}

export function requiresLogin(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function isStale(error: unknown) {
  return error instanceof ApiError && ["CURSOR_STALE", "REVISION_CONFLICT"].includes(error.code ?? "");
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "서버에 연결하지 못했습니다. 다시 시도해 주세요.";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<Envelope<T>> {
  const response = await fetch(`/api/${path}`, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 204) return { data: undefined as T, meta: {} };

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, result?.error?.code,
      result?.error?.message ?? `요청에 실패했습니다. (HTTP ${response.status})`);
  }
  if (!result || typeof result !== "object" || !("data" in result) || !result.meta) {
    throw new ApiError(response.status, undefined, "서버 응답 형식을 확인해 주세요.");
  }
  return result;
}

export async function change<T>(path: string, method: "PATCH" | "POST", body?: FormData | object) {
  const { data } = await api<{ csrfToken: string }>("auth/session");
  const headers = new Headers({ "X-CSRF-Token": data.csrfToken });
  if (body && !(body instanceof FormData)) headers.set("Content-Type", "application/json");
  return api<T>(path, {
    method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}

export type FileKind = "grades" | "timetable";
export const maxFileSize = 10 * 1024 * 1024;

export function validateFile(kind: FileKind, file: File) {
  const extension = kind === "grades" ? ".xlsx" : ".pdf";
  if (!file.name.toLowerCase().endsWith(extension)) return `${extension} 형식의 파일을 선택해 주세요.`;
  if (!file.size) return "내용이 없는 파일입니다.";
  if (file.size > maxFileSize) return "10MB 이하의 파일을 선택해 주세요.";
  return "";
}

export function uploadFiles(files: Partial<Record<FileKind, File | null>>, timetableTerm = "") {
  const body = new FormData();
  if (files.grades) body.append("grades", files.grades);
  if (files.timetable) {
    body.append("timetable", files.timetable);
    if (timetableTerm) {
      const [year, termCode] = timetableTerm.split("/");
      body.append("year", year);
      body.append("termCode", termCode);
    }
  }
  return change<{ batchId: string; parsed: number; saved: number }>("academics/imports", "POST", body);
}

export function uploadErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 503) {
    return "문서 추출 서비스를 사용할 수 없습니다. 잠시 뒤 다시 시도해 주세요.";
  }
  return errorMessage(error);
}

export interface LanguageScore {
  examType: string;
  score: number | null;
  grade: string | null;
  takenAt: string | null;
}

export interface ExpectedGraduation {
  graduationYear: number;
  graduationMonth: 2 | 8;
}

export interface Profile {
  displayName: string | null;
  departmentId: string;
  admissionYear: number;
  curriculumYear: number | null;
  expectedGraduation?: ExpectedGraduation | null;
  estimatedGraduation: ExpectedGraduation | null;
  studySemester: number;
  volunteerHours: number | null;
  languageScores: LanguageScore[];
  revision: number;
}

export interface Me {
  displayName: string;
  userId: string;
  profile: Profile | null;
  profileCompleted: boolean;
}

export interface Department {
  departmentId: string;
  name: string;
}

export interface GradeTotals {
  earnedCredits: number | null;
  enrolledCredits: number;
  gpa: number | null;
  gradeScale: number;
}

export interface GradeSummary extends GradeTotals {
  currentTerm: { year: number; termCode: "10" | "20" };
  gpaBasis: { gpaCredits: number; gradePoints: number } | null;
  warnings: Warning[];
  byCategory: { category: string; earnedCredits: number | null; enrolledCredits: number }[];
}

export interface SemesterGrade extends Omit<GradeSummary, "currentTerm"> {
  semester: { semesterId: string; name: string; year: number; termCode: string };
}

export interface GradeRecord {
  recordId: string;
  courseCode: string;
  courseName: string;
  category: string;
  credits: number;
  grade: string | null;
  gradeValid: boolean | null;
  status: "ENROLLED" | "COMPLETED" | "FAILED" | "WITHDRAWN";
}

export async function listPages<T>(path: string, signal: AbortSignal) {
  const items: T[] = [];
  let cursor = "";
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await api<{ items: T[] }>(`${path}?${query}`, { signal });
    items.push(...page.data.items);
    cursor = page.meta.nextCursor ?? "";
  } while (cursor);
  return items;
}

export function displayNumber(value: number | null, decimals?: number, suffix = "") {
  return value === null ? "—" : `${decimals === undefined ? value : value.toFixed(decimals)}${suffix}`;
}
