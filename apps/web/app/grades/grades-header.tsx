"use client";

import { useGradePlan } from "../grade-plan-provider";
import { useStudentProfile } from "../profile-provider";
import { WeatherIcon } from "../grade-weather";
import { getProfileGraduationDates, useGraduationProgress } from "../graduation-progress";
import { getSkyColors } from "../sky-colors";
import styles from "./page.module.css";

// 홈과 같은 하늘색을 사용한다. 시계 구독을 헤더에 한정해 입력 카드의 재렌더링을 줄인다.
export function GradesHeader() {
  const { profile } = useStudentProfile();
  const { data, previous, previousMajor, currentCredits } = useGradePlan();
  const progress = useGraduationProgress(getProfileGraduationDates(profile));
  const colors = progress ? getSkyColors(progress.percentage) : null;
  const fmt = (value: number | null) => value === null ? "—" : value.toFixed(2);
  return <header className={styles.header} style={colors ? { backgroundImage: `linear-gradient(180deg, ${colors.top}, ${colors.bottom})` } : undefined}>
    <div className={styles.headerTitle}><p>{data.currentSemester}학기 {currentCredits}학점 수강 중</p><h1>학점</h1></div>
    <span className={styles.headerWeather} aria-hidden="true"><WeatherIcon type="sunny" tone="hero" /></span>
    <div className={styles.headerGpa}><strong>전체 평점 {fmt(previous.gpa)}</strong><span>전공 {fmt(previousMajor.gpa)}</span></div>
  </header>;
}
