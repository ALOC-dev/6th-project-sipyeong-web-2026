import { GradeWeather } from "../grade-weather";
import { displayNumber } from "../api-client";
import type { GradeData } from "./grade-data";
import styles from "./page.module.css";

export function GradesHeader({ data }: { data?: GradeData }) {
  const term = data?.summary.currentTerm;
  return <header className={styles.header}>
    <div className={styles.headerTitle}>
      {term && <p>{term.year}학년도 {term.termCode === "10" ? "1학기" : "2학기"} · {data.enrolledCount}과목 수강 중</p>}
      <h1>학점</h1>
    </div>
    {data && <>
      <span className={styles.headerWeather} aria-hidden="true"><GradeWeather gpa={data.summary.gpa} tone="hero" /></span>
      <div className={styles.headerGpa}>
        <strong>전체 평점 {displayNumber(data.summary.gpa, 2)}</strong>
        <span>전공 평점 {displayNumber(data.majorGpa, 2)}</span>
      </div>
    </>}
  </header>;
}
