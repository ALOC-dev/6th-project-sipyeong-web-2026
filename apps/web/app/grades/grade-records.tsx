"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { displayNumber, type GradeRecord, type GradeTotals } from "../api-client";
import { HelpButton } from "../help-button";
import { useApi } from "../use-api";
import { gradeCategories, loadSemesterRecords, type GradeData } from "./grade-data";
import { HistoryChart } from "./history-chart";
import styles from "./page.module.css";

function Totals({ totals }: { totals: GradeTotals }) {
  return <dl className={styles.currentSummary}>
    <div><dt>취득 학점</dt><dd>{displayNumber(totals.earnedCredits, undefined, "학점")}</dd></div>
    <div><dt>수강 중인 학점</dt><dd>{totals.enrolledCredits}학점</dd></div>
    <div><dt>평균 평점</dt><dd>{totals.gpa === null ? "—" : `${displayNumber(totals.gpa, 2)} / ${totals.gradeScale}`}</dd></div>
  </dl>;
}

function RecordList({ records }: { records: GradeRecord[] }) {
  if (!records.length) return <p className={styles.hint}>등록된 과목이 없어요.</p>;
  return <ul>{records.map(record => (
    <li className={`${styles.courseRow} ${record.gradeValid === false ? styles.excluded : ""}`} key={record.recordId}>
      <div className={styles.courseText}>
        <h3>{record.courseName}</h3>
        <p>{record.courseCode} · {gradeCategories[record.category] ?? "미분류"} · {record.credits}학점
          {record.gradeValid === false ? " · 집계 제외" : ""}</p>
      </div>
      <span className={styles.courseGrade}>{record.status === "ENROLLED" ? "수강 중" :
        record.status === "WITHDRAWN" ? "수강 철회" : record.grade ?? "성적 미확정"}</span>
    </li>
  ))}</ul>;
}

function SemesterDetails({ semesterId }: { semesterId: string }) {
  const load = useCallback((signal: AbortSignal) => loadSemesterRecords(semesterId, signal), [semesterId]);
  const { data, error, reload } = useApi(load);
  if (error) return <><p role="alert">{error}</p><button type="button" onClick={reload}>다시 조회</button></>;
  if (!data) return <p role="status">과목을 불러오는 중…</p>;
  return <RecordList records={data} />;
}

export function GradeRecords({ data, target, onShowHelp }: {
  data: GradeData; target: number; onShowHelp: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<"gpa" | "credits">("gpa");
  const selected = data.semesters.find(item => item.semester.semesterId === selectedId);
  const totals = selected ?? data.summary;
  const term = data.summary.currentTerm;
  const currentCredits = data.currentSemester?.enrolledCredits ?? 0;

  return <div className={styles.recordGrid}>
    <div className={styles.column}>
      <section className={styles.card}>
        <h2>{term.year}학년도 {term.termCode === "10" ? "1학기" : "2학기"} 수강 중</h2>
        <dl className={styles.currentSummary}>
          <div><dt>목표 평점<small>플래너 기준</small></dt><dd>{data.currentCourses.length ? target.toFixed(2) : "—"}</dd></div>
          <div><dt>이수 예정 학점<small>{data.enrolledCount}과목 수강 중</small></dt><dd>{currentCredits}학점</dd></div>
        </dl>
      </section>
      <section className={styles.card}>
        <div className={styles.cardHeading}>
          <h2>학기별 기록 <HelpButton label="학기별 기록 기준 보기" onClick={onShowHelp} /></h2>
          <div className={styles.smallTabs} role="group" aria-label="학기별 기록 표시">
            <button type="button" aria-pressed={mode === "gpa"} onClick={() => setMode("gpa")}>평점</button>
            <button type="button" aria-pressed={mode === "credits"} onClick={() => setMode("credits")}>취득 학점</button>
          </div>
        </div>
        <HistoryChart mode={mode} semesters={[...data.semesters].reverse()}
          selectedIndex={selected ? data.semesters.length - 1 - data.semesters.indexOf(selected) : -1} />
      </section>
    </div>
    <section className={styles.card}>
      <div className={styles.cardHeading}>
        <h2>{selected?.semester.name ?? "전체 성적"}</h2>
        <Link href="/my#academic-files" className={styles.uploadLink}>파일 업데이트 ›</Link>
      </div>
      {data.semesters.length === 0 ? <p className={styles.hint}>성적표를 올리면 학기별 기록을 볼 수 있어요.</p> : <>
        <div className={styles.inputRow}>
          <label htmlFor="grade-semester">조회 범위</label>
          <select id="grade-semester" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
            <option value="">전체 학기</option>
            {data.semesters.map(({ semester }) => <option key={semester.semesterId} value={semester.semesterId}>{semester.name}</option>)}
          </select>
        </div>
        <Totals totals={totals} />
        <dl className={styles.currentSummary} aria-label="교과구분별 학점">
          {totals.byCategory.map(item => <div key={item.category}>
            <dt>{gradeCategories[item.category] ?? item.category}</dt>
            <dd>취득 {displayNumber(item.earnedCredits, undefined, "학점")} · 수강 중 {item.enrolledCredits}학점</dd>
          </div>)}
        </dl>
        {selected && (selected === data.currentSemester ? <RecordList records={data.currentRecords} /> :
          <SemesterDetails key={selectedId} semesterId={selectedId} />)}
      </>}
      {totals.warnings.filter(warning => warning.code !== "REQUIREMENT_CREDITS_UNAVAILABLE").map(warning =>
        <p key={warning.code} className={styles.error}>{warning.message}</p>)}
    </section>
  </div>;
}
