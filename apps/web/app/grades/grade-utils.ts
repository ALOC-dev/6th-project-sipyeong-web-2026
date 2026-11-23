import { deriveRelativeCutoffs, getDefaultRelativeFields, getRelativeExclusion, RELATIVE_POLICY } from "./relative-policy";
import type { CourseType, GroupRatios, RelativeFormFields } from "./relative-policy";

// API와 화면에서 분리한 순수 계산 함수다. 여기서는 네트워크·저장소를 사용하지 않는다.
export const GRADE_POINTS = {
  "A+": 4.5, A0: 4, "B+": 3.5, B0: 3, "C+": 2.5,
  C0: 2, "D+": 1.5, D0: 1, F: 0,
} as const;
export type Grade = keyof typeof GRADE_POINTS;
export const GRADES = Object.keys(GRADE_POINTS) as Grade[];
export type RecordedCourse = {
  id: string; name: string; category: string; credits: number;
  grade: Grade | "P"; valid: boolean; retake?: boolean;
};
export type Semester = { id: string; courses: RecordedCourse[] };
export type PlanCourse = Pick<RecordedCourse, "id" | "name" | "category" | "credits">;
export type Locks = Record<string, Grade | null>;
export const isMajor = (category: string) => category.startsWith("전공");

// P는 취득학점에는 포함하지만 평점 분모에서는 제외한다.
// F는 취득학점에서는 제외하지만 평점 분모에는 포함한다.
// 재수강 대체 전처럼 valid=false인 성적은 양쪽 집계에서 제외한다.
export function summarize(courses: RecordedCourse[]) {
  let earnedCredits = 0, gpaCredits = 0, gradePoints = 0;
  for (const course of courses) {
    if (!course.valid) continue;
    if (course.grade !== "F") earnedCredits += course.credits;
    if (course.grade === "P") continue;
    gpaCredits += course.credits;
    gradePoints += course.credits * GRADE_POINTS[course.grade];
  }
  return { earnedCredits, gpaCredits, gradePoints, gpa: gpaCredits ? gradePoints / gpaCredits : null };
}

export function cumulativeGpa(previous: Pick<ReturnType<typeof summarize>, "gpaCredits" | "gradePoints">, semester: Pick<ReturnType<typeof summarize>, "gpaCredits" | "gradePoints">) {
  const credits = previous.gpaCredits + semester.gpaCredits;
  return credits ? (previous.gradePoints + semester.gradePoints) / credits : null;
}

export function forecastTargetGpa(previous: { gpaCredits: number; gradePoints: number } | null, credits: number, target: number) {
  return previous && credits > 0 ? cumulativeGpa(previous, { gpaCredits: credits, gradePoints: credits * target }) : null;
}

// 원본 HTML의 '고정 성적 + 나머지 성적 배분' 흐름을 유지한다.
// 미고정 과목은 C0 이상에서 제안하며, 고정 과목은 D/F도 선택할 수 있다.
// 이 결과는 목표를 충족하는 조합 하나이지, 각 과목의 유일한 최소 성적이 아니다.
export function solvePlan(target: number, courses: PlanCourse[], locks: Locks) {
  if (!Number.isFinite(target) || target < 0 || target > 4.5) throw new RangeError("목표 평점 범위 오류");
  if (courses.some((course) => !Number.isFinite(course.credits) || course.credits <= 0)) throw new RangeError("학점 범위 오류");
  const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);
  const free = courses.filter((course) => !locks[course.id]);
  const freeCredits = free.reduce((sum, course) => sum + course.credits, 0);
  const fixedPoints = courses.reduce((sum, course) => sum + (locks[course.id] ? GRADE_POINTS[locks[course.id]!] * course.credits : 0), 0);
  const requiredPoints = target * totalCredits - fixedPoints;
  const highestGpa = totalCredits ? (fixedPoints + freeCredits * 4.5) / totalCredits : null;
  const possible = totalCredits > 0 && target <= (highestGpa ?? 0) + 1e-9;
  const requiredAverage = freeCredits ? requiredPoints / freeCredits : null;
  const allowed: Grade[] = ["C0", "C+", "B0", "B+", "A0", "A+"];
  let base: Grade = "C0";
  for (const grade of allowed) {
    if (GRADE_POINTS[grade] <= (requiredAverage ?? 2) + 1e-9) base = grade;
  }
  const assignments: Record<string, Grade> = {};
  for (const course of courses) assignments[course.id] = locks[course.id] ?? (possible ? base : "A+");
  let points = courses.reduce((sum, course) => sum + GRADE_POINTS[assignments[course.id]] * course.credits, 0);

  // 성적이 낮은 미고정 과목부터 한 단계씩 올린다.
  // 같은 단계라면 원본처럼 교양·일반선택을 먼저 올리는 예시 규칙을 사용한다.
  while (possible && points < target * totalCredits - 1e-9) {
    const candidates = free.filter((course) => assignments[course.id] !== "A+").sort((a, b) =>
      GRADE_POINTS[assignments[a.id]] - GRADE_POINTS[assignments[b.id]] || Number(isMajor(a.category)) - Number(isMajor(b.category)),
    );
    const course = candidates[0];
    if (!course) break;
    const next = allowed[allowed.indexOf(assignments[course.id]) + 1];
    points += (GRADE_POINTS[next] - GRADE_POINTS[assignments[course.id]]) * course.credits;
    assignments[course.id] = next;
  }
  const projectedCourses: RecordedCourse[] = courses.map((course) => ({ ...course, grade: assignments[course.id], valid: true }));
  return {
    possible, assignments, requiredAverage, highestGpa,
    summary: summarize(projectedCourses),
    major: summarize(projectedCourses.filter((course) => isMajor(course.category))),
    general: summarize(projectedCourses.filter((course) => !isMajor(course.category))),
  };
}

export const GOALS = ["A+", "A0", "B+", "B0"] as const;
export type GoalGrade = (typeof GOALS)[number];
export type PredictorForm = RelativeFormFields & {
  enrollment: string; midRank: string;
  attendanceScore: string; attendanceMax: string;
  assignmentScore: string; assignmentMax: string;
  attendanceWeight: string; assignmentWeight: string; midtermWeight: string; finalWeight: string;
};
export function newPredictorForm(): PredictorForm {
  return {
    enrollment: "", midRank: "",
    attendanceScore: "", attendanceMax: "10", assignmentScore: "", assignmentMax: "20",
    attendanceWeight: "10", assignmentWeight: "20", midtermWeight: "30", finalWeight: "40",
    ...getDefaultRelativeFields(),
  };
}

export type PredictionInput = {
  enrollment: number; midRank: number; attendancePercent: number; assignmentPercent: number;
  attendanceWeight: number; assignmentWeight: number; midtermWeight: number; finalWeight: number;
  courseType: CourseType;
  groupRatios: GroupRatios;
  cutoffs: Record<GoalGrade, number>;
};
export type PredictionValidation =
  | { ok: true; value: PredictionInput; defaults: string[] }
  | { ok: false; errors: Record<string, string> };

// 필수 등수와 점수·가중치, 공식 묶음 비율 및 세부 배분 가정을 각각 검사한다.
export function validatePredictor(form: PredictorForm): PredictionValidation {
  const errors: Record<string, string> = {};
  const defaults: string[] = [];
  function number(key: keyof PredictorForm, label: string, fallback?: number) {
    const raw = form[key] ?? "";
    if (!raw.trim()) {
      if (fallback !== undefined) return fallback;
      errors[key] = `${label} 입력이 필요해요.`;
      return NaN;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) errors[key] = `${label}은 숫자로 입력해주세요.`;
    return value;
  }
  const enrollment = number("enrollment", "수강 인원");
  const midRank = number("midRank", "중간고사 등수");
  if (Number.isFinite(enrollment) && (!Number.isInteger(enrollment) || enrollment < 1 || enrollment > 10000)) errors.enrollment = "수강 인원은 1~10,000명의 정수로 입력해주세요.";
  if (Number.isFinite(midRank) && (!Number.isInteger(midRank) || midRank < 1 || midRank > enrollment)) errors.midRank = "중간 등수는 1등부터 수강 인원 사이의 정수여야 해요.";

  function score(scoreKey: keyof PredictorForm, maxKey: keyof PredictorForm, label: string, defaultMax: number, defaultPercent: number) {
    const max = number(maxKey, `${label} 만점`, defaultMax);
    if (Number.isFinite(max) && max <= 0) errors[maxKey] = `${label} 만점은 0보다 커야 해요.`;
    if (!(form[scoreKey] ?? "").trim()) {
      defaults.push(`${label} ${defaultPercent}%`);
      return defaultPercent;
    }
    const value = number(scoreKey, `${label} 점수`);
    if (Number.isFinite(value) && (value < 0 || value > max)) errors[scoreKey] = `${label} 점수는 0점부터 만점 사이여야 해요.`;
    return value / max * 100;
  }
  const attendancePercent = score("attendanceScore", "attendanceMax", "출석", 10, 100);
  const assignmentPercent = score("assignmentScore", "assignmentMax", "과제", 20, 80);
  const attendanceWeight = number("attendanceWeight", "출석 비율");
  const assignmentWeight = number("assignmentWeight", "과제 비율");
  const midtermWeight = number("midtermWeight", "중간고사 비율");
  const finalWeight = number("finalWeight", "기말고사 비율");
  const weights = [attendanceWeight, assignmentWeight, midtermWeight, finalWeight];
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0 || weight > 100) || Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 100) > 1e-6) errors.weights = "평가 비율은 각각 0~100%, 합계 100%여야 해요.";
  if (Number.isFinite(finalWeight) && finalWeight <= 0) errors.finalWeight = "기말 등수를 추정하려면 기말고사 비율이 0%보다 커야 해요.";

  if (!["regular", "teacher", "graduate"].includes(form.courseType)) errors.courseType = "강좌 유형을 선택해주세요.";
  const groupRatios = {} as GroupRatios;
  for (const rule of RELATIVE_POLICY) {
    const value = number(rule.formKey, `${rule.label} 비율`);
    groupRatios[rule.group] = value;
    if (Number.isFinite(value) && (value < rule.min || value > rule.max)) errors[rule.formKey] = `${rule.label} 비율은 ${rule.min}~${rule.max}% 범위여야 해요.`;
  }
  if (Math.abs(Object.values(groupRatios).reduce((sum, value) => sum + value, 0) - 100) > 1e-6) errors.groupTotal = "등급 묶음 비율의 합계는 100%여야 해요.";
  const aPlusShare = number("aPlusShare", "A등급 내 A+ 비중");
  const bPlusShare = number("bPlusShare", "B등급 내 B+ 비중");
  if (Number.isFinite(aPlusShare) && (aPlusShare < 0 || aPlusShare > 100)) errors.aPlusShare = "A등급 내 A+ 비중은 0~100%여야 해요.";
  if (Number.isFinite(bPlusShare) && (bPlusShare < 0 || bPlusShare > 100)) errors.bPlusShare = "B등급 내 B+ 비중은 0~100%여야 해요.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, defaults, value: {
    enrollment, midRank, attendancePercent, assignmentPercent, attendanceWeight, assignmentWeight, midtermWeight, finalWeight,
    courseType: form.courseType as CourseType,
    groupRatios, cutoffs: deriveRelativeCutoffs(groupRatios, aPlusShare, bPlusShare),
  } };
}

export type RankEstimate = {
  status: "rank" | "any" | "unreachable" | "excluded";
  rank: number | null;
  percentage: number;
  rawPercentage: number;
  reason?: string;
};

export function estimateFinalRank(input: PredictionInput, goal: GoalGrade): RankEstimate {
  // 적용 제외 강좌는 함수 직접 호출 시에도 학교 비율로 추정하지 않는다.
  const exclusion = getRelativeExclusion(input.enrollment, input.courseType);
  if (exclusion) return { status: "excluded", rank: null, percentage: 0, rawPercentage: 0, reason: exclusion };
  // 등급 묶음 비율은 제공된 규정을 반영하지만 아래 점수→등수 환산은 기존 가정이다.
  // 실제 학생의 점수 분포로 검증한 모형이나 학점 보장 결과가 아니다.
  const midPercentile = input.midRank / input.enrollment * 100;
  const attendancePercentile = 100 - input.attendancePercent;
  const assignmentPercentile = Math.min(95, Math.max(5, (100 - input.assignmentPercent) * 2));
  const known = attendancePercentile * input.attendanceWeight / 100
    + assignmentPercentile * input.assignmentWeight / 100
    + midPercentile * input.midtermWeight / 100;
  const rawPercentage = (input.cutoffs[goal] - known) / (input.finalWeight / 100);
  const rank = Math.floor(rawPercentage / 100 * input.enrollment + 1e-9);
  if (rank < 1) return { status: "unreachable", rank: null, percentage: 0, rawPercentage };
  if (rank >= input.enrollment) return { status: "any", rank: input.enrollment, percentage: 100, rawPercentage };
  return { status: "rank", rank, percentage: rank / input.enrollment * 100, rawPercentage };
}
