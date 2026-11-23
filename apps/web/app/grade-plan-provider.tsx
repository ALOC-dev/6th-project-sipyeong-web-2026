"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { forecastTargetGpa, solvePlan, type Locks, type PlanCourse } from "./grades/grade-utils";
import type { GradeSummary } from "./api-client";
import { useSemesterTarget } from "./semester-target";

function usePlanState(userId: string, summary: GradeSummary, courses: PlanCourse[]) {
  const [target, setTarget] = useSemesterTarget(userId, summary.currentTerm);
  const [locks, setLocks] = useState<Locks>({});
  const plan = solvePlan(target, courses, locks);
  const forecast = plan.possible
    ? forecastTargetGpa(summary.gpaBasis, courses.reduce((sum, course) => sum + course.credits, 0), target) : null;
  return {
    target, setTarget, locks, setLocks, plan, forecast, currentGpa: summary.gpa,
    resetPlan: () => { setTarget(); setLocks({}); },
  };
}

const GradePlanContext = createContext<ReturnType<typeof usePlanState> | null>(null);

export function GradePlanProvider({ children, userId, summary, courses }: {
  children: ReactNode; userId: string; summary: GradeSummary; courses: PlanCourse[];
}) {
  const value = usePlanState(userId, summary, courses);
  return <GradePlanContext.Provider value={value}>{children}</GradePlanContext.Provider>;
}

export function useGradePlan() {
  const value = useContext(GradePlanContext);
  if (!value) throw new Error("GradePlanProvider로 화면을 감싸주세요.");
  return value;
}
