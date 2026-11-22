import type { Grade, Locks, PlanCourse, PredictorForm, RecordedCourse, Semester } from "./grade-utils";

// 원본 졸업이루매 HTML의 과목·학기 구성을 참고한 예시다. 실제 성적표 데이터가 아니다.
// 원본은 학기 평점 숫자가 과목 성적과 일치하지 않아, 여기서는 과목에서 직접 계산한다.
function course(id: string, name: string, category: string, credits: number, grade: Grade | "P", valid = true, retake = false): RecordedCourse {
  return { id, name, category, credits, grade, valid, retake };
}

export const HISTORY: Semester[] = [
  { id: "2024-1", courses: [
    course("a1", "컴퓨터과학개론", "전공필수", 3, "A0"),
    course("a2", "대학영어", "교양필수", 3, "B+"),
    course("a3", "미적분학", "교양필수", 3, "C+", false),
    course("a4", "철학의 이해", "교양선택", 3, "B0"),
    course("a5", "진로탐색과 설계", "일반선택", 1, "P"),
  ] },
  { id: "2024-2", courses: [
    course("b1", "자료구조", "전공필수", 3, "B+"),
    course("b2", "이산구조 기초", "전공선택", 3, "A0"),
    course("b3", "객체지향프로그래밍", "전공선택", 3, "B+"),
    course("b4", "일반물리", "교양필수", 3, "B0"),
    course("b5", "한국사의 이해", "교양선택", 3, "A0"),
    course("b6", "논리와 사고", "교양선택", 3, "B+"),
  ] },
  { id: "2025-1", courses: [
    course("c1", "알고리즘", "전공필수", 3, "A0"),
    course("c2", "확률과통계", "전공선택", 3, "A0"),
    course("c3", "컴퓨터구조", "전공필수", 3, "B+"),
    course("c4", "프로그래밍언어론", "전공선택", 3, "A0"),
    course("c5", "현대미술의 이해", "교양선택", 3, "B+"),
  ] },
  { id: "2025-2", courses: [
    course("d1", "운영체제 기초", "전공필수", 3, "B+"),
    course("d2", "빅데이터처리", "일반선택", 3, "A0"),
    course("d3", "선형대수", "교양필수", 3, "B+"),
    course("d4", "웹프로그래밍", "전공선택", 3, "B+"),
    course("d5", "도시와 환경", "교양선택", 3, "B+"),
  ] },
  { id: "2026-1", courses: [
    course("e1", "데이터베이스", "전공선택", 3, "A+"),
    course("e2", "소프트웨어공학", "전공선택", 3, "A0"),
    course("e3", "통계학입문", "전공선택", 3, "A0"),
    course("e4", "미적분학", "교양필수", 3, "A0", true, true),
    course("e5", "컴퓨터그래픽스", "전공선택", 3, "A+"),
    course("e6", "도시와 건축", "일반선택", 3, "A+"),
  ] },
];

export const CURRENT_SEMESTER = "2026-2";
export const CURRENT_COURSES: PlanCourse[] = [
  { id: "discrete", name: "이산수학", category: "전공필수", credits: 3 },
  { id: "unix", name: "유닉스프로그래밍", category: "전공필수", credits: 3 },
  { id: "network", name: "데이터통신", category: "전공선택", credits: 3 },
  { id: "machine", name: "데이터중심 머신러닝", category: "전공선택", credits: 3 },
  { id: "ai", name: "인공지능", category: "전공선택", credits: 3 },
  { id: "writing", name: "글쓰기와 비평", category: "교양선택", credits: 3 },
  { id: "art", name: "서양미술사", category: "일반선택", credits: 3 },
];

export const INITIAL_LOCKS: Locks = { discrete: "B+", unix: "A+" };

// 스크린샷의 10/20/30/40 비율과 원본 HTML의 등급 컷을 예시 기본값으로 사용한다.
// 학교·강의의 공식 기준 또는 강의계획서에서 읽어온 값이 아니다.
export function makePredictorForms(courses: PlanCourse[] = CURRENT_COURSES): Record<string, PredictorForm> {
  return Object.fromEntries(courses.map((item) => [item.id, {
    enrollment: "60", midRank: "34",
    attendanceScore: "9", attendanceMax: "10",
    assignmentScore: "15", assignmentMax: "20",
    attendanceWeight: "10", assignmentWeight: "20", midtermWeight: "30", finalWeight: "40",
    cutoffAPlus: "15", cutoffA0: "30", cutoffBPlus: "50", cutoffB0: "70",
  }]));
}
