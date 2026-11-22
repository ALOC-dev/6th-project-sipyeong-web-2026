// 사용자가 제공한 학교 성적평가 규정의 '등급 묶음' 비율이다.
// ±5는 퍼센트포인트로 해석하며 선택한 네 묶음의 합계는 100%여야 한다.
export const RELATIVE_POLICY = [
  { group: "A", formKey: "ratioA", label: "A+ · A0", base: 30, min: 25, max: 35 },
  { group: "B", formKey: "ratioB", label: "B+ · B0", base: 40, min: 35, max: 45 },
  { group: "C", formKey: "ratioC", label: "C+ · C0", base: 20, min: 15, max: 25 },
  { group: "DF", formKey: "ratioDF", label: "D+ · D0 · F", base: 10, min: 5, max: 15 },
] as const;

export type GradeGroup = (typeof RELATIVE_POLICY)[number]["group"];
type RatioFormKey = (typeof RELATIVE_POLICY)[number]["formKey"];
export type GroupRatios = Record<GradeGroup, number>;
export type CourseType = "regular" | "teacher" | "graduate";
export type RelativeFormFields = Record<RatioFormKey, string> & {
  courseType: string;
  aPlusShare: string;
  bPlusShare: string;
};

export function getDefaultRelativeFields(): RelativeFormFields {
  const ratios = Object.fromEntries(RELATIVE_POLICY.map((rule) => [rule.formKey, String(rule.base)])) as Record<RatioFormKey, string>;
  return {
    ...ratios,
    courseType: "regular",
    // 제공된 규정에는 +/0 세부 배분이 없다. 50:50은 수정 가능한 시뮬레이션 가정이다.
    aPlusShare: "50",
    bPlusShare: "50",
  };
}

export function getRelativeExclusion(enrollment: number, courseType: string): string | null {
  if (courseType === "graduate") return "대학원 강좌는 제공된 상대평가 기준의 적용 대상에서 제외돼요. 해당 강좌의 평가 기준을 확인해주세요.";
  if (courseType === "teacher") return "교직과목은 제공된 상대평가 기준의 적용 대상에서 제외돼요. 해당 강좌의 평가 기준을 확인해주세요.";
  if (Number.isInteger(enrollment) && enrollment >= 1 && enrollment <= 15) return "수강인원 15명 이하 강좌는 제공된 상대평가 기준의 적용 대상에서 제외돼요. 해당 강좌의 평가 기준을 확인해주세요.";
  return null;
}

// A0·B0는 '해당 등급 이상'의 누적 비율이다.
// 예: A=30, B=40, +/0를 반씩 가정하면 A+ 15, A0 30, B+ 50, B0 70이다.
export function deriveRelativeCutoffs(groups: GroupRatios, aPlusShare: number, bPlusShare: number) {
  return {
    "A+": groups.A * aPlusShare / 100,
    A0: groups.A,
    "B+": groups.A + groups.B * bPlusShare / 100,
    B0: groups.A + groups.B,
  };
}

export function getRelativeSegments(groups: GroupRatios, cutoffs: ReturnType<typeof deriveRelativeCutoffs>) {
  return [
    { label: "A+", width: cutoffs["A+"] },
    { label: "A0", width: cutoffs.A0 - cutoffs["A+"] },
    { label: "B+", width: cutoffs["B+"] - cutoffs.A0 },
    { label: "B0", width: cutoffs.B0 - cutoffs["B+"] },
    // 화면에서는 C+부터 F까지를 하나로 묶는다. 원래 분포와 등수 계산 기준은 유지한다.
    { label: "C+ 이하", width: groups.C + groups.DF },
  ];
}
