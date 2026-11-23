"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { CURRENT_COURSES, CURRENT_SEMESTER, HISTORY, INITIAL_LOCKS } from "./grades/sample-data";
import { cumulativeGpa, isMajor, solvePlan, summarize } from "./grades/grade-utils";
import type { Locks, PlanCourse, Semester } from "./grades/grade-utils";

export type AcademicSnapshot = {
  source: "sample" | "api";
  history: Semester[];
  currentSemester: string;
  currentCourses: PlanCourse[];
  remainingSemesterAverage: number | null;
};
// 원본 성적은 기존 예시 파일 한 곳에서 가져온다. API 연결 시 이 입력 스냅샷을 교체한다.
const SAMPLE: AcademicSnapshot = {
  source: "sample", history: HISTORY, currentSemester: CURRENT_SEMESTER,
  currentCourses: CURRENT_COURSES,
  // 남은 학기 전체 평점 계획은 아직 없으므로 숫자를 만들어 넣지 않는다.
  remainingSemesterAverage: null,
};
const DEFAULT_TARGET = 3.75;

function usePlanState(data: AcademicSnapshot) {
  const initialLocks = data.source === "sample" ? INITIAL_LOCKS : {};
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [locks, setLocks] = useState<Locks>(() => ({ ...initialLocks }));
  const courses = data.history.flatMap((semester) => semester.courses);
  const previous = summarize(courses);
  const previousMajor = summarize(courses.filter((course) => isMajor(course.category)));
  const semesterSummaries = data.history.map((semester) => summarize(semester.courses));
  const currentCredits = data.currentCourses.reduce((sum, course) => sum + course.credits, 0);
  const plan = solvePlan(target, data.currentCourses, locks);
  return {
    data, previous, previousMajor, semesterSummaries, currentCredits, target, locks, plan,
    forecast: plan.possible ? cumulativeGpa(previous, plan.summary) : null,
    setTarget,
    setLocks,
    resetPlan: () => { setTarget(DEFAULT_TARGET); setLocks({ ...initialLocks }); },
  };
}
const GradePlanContext = createContext<ReturnType<typeof usePlanState> | null>(null);

// 홈과 학점 화면이 같은 목표와 고정 성적을 읽는다.
// 현재는 메모리 상태이므로 페이지 이동에는 유지되고 새로고침하면 초기화된다.
export function GradePlanProvider({ children, initialData = SAMPLE }: {
  children: ReactNode; initialData?: AcademicSnapshot;
}) {
  const value = usePlanState(initialData);
  return <GradePlanContext.Provider value={value}>{children}</GradePlanContext.Provider>;
}
export function useGradePlan() {
  const value = useContext(GradePlanContext);
  if (!value) throw new Error("GradePlanProvider로 화면을 감싸주세요.");
  return value;
}
