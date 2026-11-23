"use client";

import { useGradePlan } from "../grade-plan-provider";
import { GradeWeather } from "../grade-weather";
import styles from "./page.module.css";

// 숫자와 날씨 모두 공유 성적 목록에서 계산한다. 사진의 예시 숫자를 별도로 저장하지 않는다.
export function HistoryChart({ mode, selectedIndex }: { mode: "gpa" | "credits"; selectedIndex: number }) {
  const { data, semesterSummaries } = useGradePlan();
  if (!data.history.length) return <p className={styles.hint}>등록된 성적이 없어요.</p>;
  const gpa = mode === "gpa";
  const values = semesterSummaries.map((summary) => gpa ? summary.gpa : summary.earnedCredits);
  const available = values.filter((value): value is number => value !== null);
  const low = gpa ? Math.min(3, Math.floor(Math.min(...available, 4.5) * 2) / 2) : 0;
  const high = gpa ? 4.5 : Math.max(24, Math.ceil(Math.max(...available, 0) / 6) * 6);
  const width = Math.max(360, data.history.length * 56 + 64);
  const height = gpa ? 186 : 160;
  const top = gpa ? 44 : 18;
  const bottom = height - 32;
  const x = (index: number) => data.history.length === 1 ? width / 2 : 40 + index * (width - 64) / (data.history.length - 1);
  const y = (value: number) => top + (high - value) / (high - low) * (bottom - top);
  const step = gpa ? .5 : 6;
  const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, index) => low + index * step);
  // P만 있는 학기처럼 평점이 없으면 선을 끊어 0점으로 오해하지 않게 한다.
  const path = values.map((value, index) => value === null ? "" : `${index === 0 || values[index - 1] === null ? "M" : "L"}${x(index)} ${y(value)}`).join(" ");

  return <div className={styles.chartScroller}>
    <svg className={styles.historyChart} style={data.history.length > 6 ? { minWidth: width } : undefined} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={gpa ? "학기별 평점 추이" : "학기별 유효 취득학점"}>
      <title>{data.history.map((semester, index) => `${semester.id}: ${values[index] === null ? "평점 없음" : gpa ? values[index]!.toFixed(2) : `${values[index]}학점`}`).join(", ")}</title>
      {ticks.map((tick) => <g key={tick}><line x1="34" x2={width - 10} y1={y(tick)} y2={y(tick)} stroke="var(--line)" /><text x="4" y={y(tick) + 4} className={styles.chartLabel}>{gpa ? tick.toFixed(1) : tick}</text></g>)}
      {gpa && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />}
      {values.map((value, index) => <g key={data.history[index].id}>
        {gpa && <svg x={x(index) - 10} y="4" width="20" height="20" viewBox="0 0 24 24"><GradeWeather gpa={semesterSummaries[index].gpa} /></svg>}
        {value !== null && (gpa ? <circle cx={x(index)} cy={y(value)} r={index === selectedIndex ? 5 : 3.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" /> : <rect x={x(index) - 14} y={y(value)} width="28" height={bottom - y(value)} rx="3" fill="var(--accent)" opacity={index === selectedIndex ? 1 : .46} />)}
        <text x={x(index)} y={value === null ? bottom - 8 : y(value) - 10} textAnchor="middle" className={styles.chartValue}>{value === null ? "—" : gpa ? value.toFixed(2) : value}</text>
        <text x={x(index)} y={height - 7} textAnchor="middle" className={styles.chartLabel}>{data.history[index].id}</text>
      </g>)}
    </svg>
  </div>;
}
