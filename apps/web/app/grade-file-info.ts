// 현재 내 정보에 표시하던 예시 성적 파일 정보다.
// 사이드바와 내 정보가 같은 값을 읽는다. API 연결 시 실제 업로드 결과로 교체한다.
// 파일을 선택만 한 상태에서는 반영일을 바꾸지 않는다.
export const SAMPLE_GRADE_FILE = {
  name: "성적조회_2026-1.xlsx",
  appliedAt: "10.31",
  courseCount: 27,
} as const;
