import { summarize } from "./grades/grade-utils";
import type { RecordedCourse } from "./grades/grade-utils";

// MVP에서 지원하는 학과와 입학연도 선택지를 한 곳에서 관리한다.
export const SUPPORTED_DEPARTMENT = "컴퓨터과학부" as const;
export const ADMISSION_YEARS = [2026, 2025, 2024, 2023, 2022] as const;
// 서비스에서 표시하는 졸업 시기 범위다. 학교의 공식 최대 재학연한을 정의하는 값은 아니다.
export const MIN_GRADUATION_YEAR_OFFSET = 3;
export const MAX_GRADUATION_YEAR_OFFSET = 12;

// 이전 선택값이나 입학연도 변경으로 선택 범위를 벗어나면 양 끝 연도로 맞춘다.
export function clampGraduationYear(admissionYear: number, graduationYear: number) {
  const year = Number.isInteger(graduationYear) ? graduationYear : admissionYear + 4;
  return Math.max(admissionYear + MIN_GRADUATION_YEAR_OFFSET,
    Math.min(admissionYear + MAX_GRADUATION_YEAR_OFFSET, year));
}

export type GraduationMonth = 2 | 8;
export type StudentProfile = {
  department: typeof SUPPORTED_DEPARTMENT;
  admissionYear: number;
  graduationYear: number;
  graduationMonth: GraduationMonth;
  engineeringCertification: boolean;
};

// 현재 내 정보 화면의 예시 프로필을 초기값으로 유지한다.
export const DEFAULT_PROFILE: StudentProfile = {
  department: SUPPORTED_DEPARTMENT,
  admissionYear: 2024,
  graduationYear: 2028,
  graduationMonth: 2,
  engineeringCertification: true,
};

// 사용자가 제공한 화면의 2024학년도 예시 기준이다.
// 다른 입학연도는 기준 데이터가 확보되면 여기 또는 BE 응답에 추가한다.
// 2024학년도 숫자를 다른 입학연도에도 임의로 적용하지 않는다.
type CurriculumRequirements = {
  total: number;
  majorRequired: number;
  majorElective: number;
  general: number;
};
const CURRICULUM_REQUIREMENTS: Partial<Record<number, CurriculumRequirements>> = {
  2024: { total: 130, majorRequired: 27, majorElective: 39, general: 30 },
};
export function getCurriculumRequirements(admissionYear: number) {
  return CURRICULUM_REQUIREMENTS[admissionYear];
}

// 공학인증을 켜면 공학소양 '필요 학점'이 8학점이다.
// 총 졸업학점이나 취득학점에 8학점을 더하지 않는다.
export function getEngineeringRequiredCredits(profile: StudentProfile) {
  return profile.engineeringCertification ? 8 : 0;
}

export function validateProfile(profile: StudentProfile): string | null {
  if (profile.department !== SUPPORTED_DEPARTMENT) return "현재는 컴퓨터과학부만 지원해요.";
  if (!ADMISSION_YEARS.some((year) => year === profile.admissionYear)) return "입학연도를 다시 선택해주세요.";
  // 선택지와 저장 검증에 같은 3~12년 범위를 사용한다.
  if (!Number.isInteger(profile.graduationYear) || profile.graduationYear < profile.admissionYear + MIN_GRADUATION_YEAR_OFFSET || profile.graduationYear > profile.admissionYear + MAX_GRADUATION_YEAR_OFFSET) {
    return `졸업 예정 시기는 입학연도에서 ${MIN_GRADUATION_YEAR_OFFSET}~${MAX_GRADUATION_YEAR_OFFSET}년 뒤 사이로 선택해주세요.`;
  }
  if (profile.graduationMonth !== 2 && profile.graduationMonth !== 8) {
    return "졸업 예정월은 2월 또는 8월로 선택해주세요.";
  }
  if (typeof profile.engineeringCertification !== "boolean") return "공학인증 이수 대상 여부를 확인해주세요.";
  return null;
}

// 공학소양은 교양선택 안의 세부 영역일 수도 있으므로 별도 태그도 지원한다.
// 과목 이름으로 분류를 추측하지 않고, 분류 또는 태그가 있는 과목만 집계한다.
export type AreaCourse = RecordedCourse & { areas?: readonly string[] };
export function getEngineeringStatus(profile: StudentProfile, courses: AreaCourse[]) {
  const required = getEngineeringRequiredCredits(profile);
  const completed = summarize(courses.filter((course) =>
    course.category === "공학소양" || course.areas?.includes("engineering"),
  )).earnedCredits;
  return {
    required,
    completed,
    remaining: Math.max(0, required - completed),
    progress: required ? Math.min(100, completed / required * 100) : 100,
  };
}

// 입학+3년부터 입학+12년까지 10개 연도만 표시한다.
export function getGraduationYears(admissionYear: number) {
  const first = admissionYear + MIN_GRADUATION_YEAR_OFFSET;
  const last = admissionYear + MAX_GRADUATION_YEAR_OFFSET;
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export function formatGraduationPeriod(profile: Pick<StudentProfile, "graduationYear" | "graduationMonth">) {
  return `${profile.graduationYear}년 ${profile.graduationMonth}월`;
}

// 같은 연도 안에서 2월, 8월 순서로 선택지를 만든다.
export function getGraduationOptions(admissionYear: number) {
  return getGraduationYears(admissionYear).flatMap((year) =>
    ([2, 8] as const).map((month) => ({
      year, month, value: `${year}-${String(month).padStart(2, "0")}`,
      label: formatGraduationPeriod({ graduationYear: year, graduationMonth: month }),
    })),
  );
}

// 2월 졸업은 전년도 2학기까지, 8월 졸업은 해당 연도 1학기까지 수강한다.
export function getLastStudySemester(graduationYear: number, graduationMonth: GraduationMonth) {
  return graduationMonth === 2 ? `${graduationYear - 1}-2` : `${graduationYear}-1`;
}

export function getRemainingSemesterCount(currentSemester: string, graduationYear: number, graduationMonth: GraduationMonth = 2) {
  const match = /^(\d{4})-([12])$/.exec(currentSemester);
  if (!match) throw new RangeError("현재 학기 형식을 확인해주세요.");
  const current = Number(match[1]) * 2 + Number(match[2]) - 1;
  const lastId = getLastStudySemester(graduationYear, graduationMonth);
  const [lastYear, lastTerm] = lastId.split("-").map(Number);
  const last = lastYear * 2 + lastTerm - 1;
  return Math.max(0, last - current + 1);
}
