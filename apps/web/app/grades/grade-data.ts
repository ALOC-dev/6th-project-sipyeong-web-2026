import { api, listPages, type GradeRecord, type GradeSummary, type Me, type SemesterGrade } from "../api-client";

export const gradeCategories: Record<string, string> = {
  MAJOR_REQUIRED: "전공필수", MAJOR_ELECTIVE: "전공선택", GENERAL: "교양",
  OTHER: "기타", UNCLASSIFIED: "미분류",
};

export function loadSemesterRecords(semesterId: string, signal: AbortSignal) {
  return listPages<GradeRecord>(`grades/semesters/${encodeURIComponent(semesterId)}`, signal);
}

export async function loadGrades(signal: AbortSignal) {
  const [summary, major, semesters, me] = await Promise.all([
    api<GradeSummary>("grades/summary", { signal }),
    api<GradeSummary>("grades/summary?category=MAJOR", { signal }),
    listPages<SemesterGrade>("grades/semesters", signal),
    api<Me>("users/me", { signal }),
  ]);
  const { currentTerm } = summary.data;
  const currentSemester = semesters.find(({ semester }) =>
    semester.year === currentTerm.year && semester.termCode === currentTerm.termCode);
  const currentRecords = currentSemester ? await loadSemesterRecords(currentSemester.semester.semesterId, signal) : [];
  const enrolled = currentRecords.filter(record => record.status === "ENROLLED");
  const currentCourses = enrolled.filter(record => record.credits > 0).map(record => ({
    id: record.recordId, name: record.courseName, category: gradeCategories[record.category] ?? "미분류",
    credits: record.credits,
  }));
  return { userId: me.data.userId, summary: summary.data, majorGpa: major.data.gpa, semesters, currentSemester, currentRecords, currentCourses, enrolledCount: enrolled.length };
}

export type GradeData = Awaited<ReturnType<typeof loadGrades>>;
