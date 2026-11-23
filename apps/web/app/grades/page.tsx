"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AcademicNav } from "../academic-nav";
import { api, displayNumber, listPages, type GradeRecord, type GradeSummary, type GradeTotals, type SemesterGrade } from "../api-client";
import { useApi } from "../use-api";
import styles from "../page.module.css";

const categories: Record<string, string> = {
  MAJOR_REQUIRED: "전공필수", MAJOR_ELECTIVE: "전공선택", GENERAL: "교양",
  OTHER: "기타", UNCLASSIFIED: "미분류",
};

async function loadGrades(signal: AbortSignal) {
  const [summary, semesters] = await Promise.all([
    api<GradeSummary>("grades/summary", { signal }),
    listPages<SemesterGrade>("grades/semesters", signal),
  ]);
  return { summary: summary.data, semesters };
}

function Totals({ totals }: { totals: GradeTotals }) {
  return (
    <dl className={styles.summaryList}>
      <div className={styles.summaryRow}><dt>취득학점</dt><dd>{displayNumber(totals.earnedCredits)}</dd></div>
      <div className={styles.summaryRow}><dt>수강 중인 학점</dt><dd>{displayNumber(totals.enrolledCredits)}</dd></div>
      <div className={styles.summaryRow}><dt>평균평점</dt><dd>{totals.gpa === null ? "—" : `${displayNumber(totals.gpa, 2)} / ${totals.gradeScale}`}</dd></div>
    </dl>
  );
}

function SemesterDetails({ semesterId }: { semesterId: string }) {
  const load = useCallback((signal: AbortSignal) =>
    listPages<GradeRecord>(`grades/semesters/${encodeURIComponent(semesterId)}`, signal), [semesterId]);
  const { data, error, reload } = useApi(load);

  if (error) return <><p role="alert">{error}</p><button type="button" onClick={reload}>다시 조회</button></>;
  if (!data) return <p role="status">과목을 불러오는 중…</p>;
  if (!data.length) return <p>등록된 과목이 없습니다.</p>;

  return (
    <ul className={styles.summaryList}>
      {data.map((record) => (
        <li className={styles.summaryRow} key={record.recordId}>
          <span>{record.courseName} <small>{record.courseCode}</small></span>
          <span>
            {record.credits}학점 · {
              record.status === "ENROLLED" ? "수강 중" :
                record.status === "WITHDRAWN" ? "수강 철회" : record.grade ?? "성적 미확정"
            }{record.gradeValid === false ? " · 집계 제외" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function GradesPage() {
  const { data, error, reload } = useApi(loadGrades);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const semester = data?.semesters.find((item) => item.semester.semesterId === selectedId);

  return (
    <main className={styles.page}>
      <header className={styles.hero}><h1 className={styles.title}>학점·성적 기록</h1></header>
      <div className={styles.content}>
        {error && <section className={styles.card}><p role="alert">{error}</p><button type="button" onClick={reload}>다시 시도</button></section>}
        {!data && !error && <p role="status">성적을 불러오는 중…</p>}
        {data && (
          <section className={styles.card}>
            <div className={styles.cardHeading}><h2>{semester ? semester.semester.name : "전체 성적"}</h2><Link href="/my">파일 업데이트 ›</Link></div>
            {data.semesters.length === 0 ? <p>등록된 성적이 없습니다.</p> : (
              <>
                <label htmlFor="grade-semester">조회 범위 </label>
                <select id="grade-semester" value={selectedId ?? ""} onChange={(event) => setSelectedId(event.target.value || null)}>
                  <option value="">전체 학기</option>
                  {data.semesters.map(({ semester }) => <option key={semester.semesterId} value={semester.semesterId}>{semester.name}</option>)}
                </select>
                <Totals totals={semester ?? data.summary} />
                <ul className={styles.summaryList}>
                  {(semester ?? data.summary).byCategory.map((item) => (
                    <li className={styles.summaryRow} key={item.category}>
                      <span>{categories[item.category] ?? item.category}</span>
                      <span>취득 {displayNumber(item.earnedCredits, undefined, "학점")} · 수강 중 {item.enrolledCredits}학점</span>
                    </li>
                  ))}
                </ul>
                {semester && <SemesterDetails key={semester.semester.semesterId} semesterId={semester.semester.semesterId} />}
              </>
            )}
            {(semester ?? data.summary).warnings.filter((warning) => warning.code !== "REQUIREMENT_CREDITS_UNAVAILABLE").map((warning) => (
              <p className={styles.warning} key={warning.code}>{warning.message}</p>
            ))}
          </section>
        )}
      </div>
      <AcademicNav current="/grades" />
    </main>
  );
}
