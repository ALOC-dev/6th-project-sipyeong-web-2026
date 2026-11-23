import type { FileKind } from "./api-client";

export const uploadInfo = {
  grades: {
    title: "전체성적조회 성적표 (XLSX)",
    dialogTitle: "성적 파일 업데이트",
    description: "포털의 전체성적조회에서 내려받은 Excel 원본을 선택해 주세요.",
    extension: ".xlsx",
    guide: ["대학행정 접속", "수업/성적 → 성적표조회", "전체성적조회 선택", "Excel 다운로드"],
  },
  timetable: {
    title: "수강신청확인서 (PDF)",
    dialogTitle: "수강신청확인서 PDF 등록",
    description: "포털에서 발급한 수강신청확인서 PDF 원본을 선택해 주세요.",
    extension: ".pdf",
    guide: ["대학행정 접속", "수강 → 수강신청확인서", "해당 학기 수강 내역 확인", "PDF 저장"],
  },
} satisfies Record<FileKind, { title: string; dialogTitle: string; description: string; extension: string; guide: string[] }>;

export function TimetableTermSelect({ value, onChange, disabled }: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Seoul" }).format(new Date()));
  const years = Array.from({ length: Math.max(0, year - 2019) }, (_, index) => year - index);
  return (
    <label>
      PDF에 기록된 학기{" "}
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">현재 학기 (자동)</option>
        {years.map((item) => (
          <optgroup key={item} label={`${item}학년도`}>
            <option value={`${item}/10`}>{item}학년도 1학기</option>
            <option value={`${item}/20`}>{item}학년도 2학기</option>
          </optgroup>
        ))}
      </select>
    </label>
  );
}
