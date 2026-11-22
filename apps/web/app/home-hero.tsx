"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { HelpButton } from "./help-button";
import { getSkyColors } from "./sky-colors";
import { AppIcon } from "./app-icon";
import { useStudentProfile } from "./profile-provider";
import { useGradePlan } from "./grade-plan-provider";
import { buildSemesterWeather, getWeatherType, WeatherIcon } from "./grade-weather";
import { calculatePeriodProgress, formatGraduationDate, getProfileGraduationDates, useGraduationProgress } from "./graduation-progress";
import { GraduationProgressDialog } from "./graduation-progress-dialog";
import { SemesterGpaDialog } from "./semester-gpa-dialog";
import styles from "./home-hero.module.css";

// HTML 초안의 예시 일정이다. 실제 학사 일정 API 연결 시 이 설정을 교체한다.
const DEMO_PERIODS = [
  { label: "이번 학기", start: "2026-09-01", end: "2026-12-19", caption: "12.19 종강" },
  { label: "학년도", start: "2026-03-02", end: "2027-03-01", caption: "2.28까지" },
];

// 실시간 시계 구독은 이 컴포넌트에만 둬서 아래 카드 전체가 매번 렌더링되지 않게 한다.
export function HomeHero() {
  const { profile } = useStudentProfile();
  const { data, target } = useGradePlan();
  const progressDialogRef = useRef<HTMLDialogElement>(null);
  const semesterDialogRef = useRef<HTMLDialogElement>(null);
  const dates = getProfileGraduationDates(profile);
  const progress = useGraduationProgress(dates);
  const position = (progress?.percentage ?? 0) / 100;
  const sunY = 80 - 240 * position * (1 - position);
  const curveId = useId().replaceAll(":", "");
  const sky = getSkyColors(position * 100);
  // 예시 학기에서 학년을 표시한다. 실제 학년 API가 생기면 그 값으로 교체한다.
  const [currentYear, currentTerm] = data.currentSemester.split("-").map(Number);
  const yearLabel = `${Math.max(1, currentYear - profile.admissionYear + 1)}학년`;
  const semesters = buildSemesterWeather({
    history: data.history, currentSemester: data.currentSemester,
    admissionYear: profile.admissionYear, graduationYear: profile.graduationYear,
    graduationMonth: profile.graduationMonth,
    currentTarget: data.currentCourses.length ? target : null,
    remainingSemesterAverage: data.remainingSemesterAverage,
  });

  return <header className={styles.hero} style={{ backgroundImage: `linear-gradient(180deg, ${sky.top}, ${sky.bottom})` }}>
    <div className={styles.heading}>
      <div><p className={styles.student}>{profile.department} {yearLabel} {currentTerm}학기</p><h1>졸업 현황</h1></div>
      <HelpButton label="졸업 진행률 산정 기준 보기" tone="hero" large onClick={() => progressDialogRef.current?.showModal()} />
    </div>
    {/* 실제 지난 시간을 소수점 7자리로 표시한다. 임의로 숫자를 증가시키는 애니메이션이 아니다. */}
    <p className={styles.percentage}>{progress ? progress.percentage.toFixed(7) : "—"}<span>%</span></p>
    <p className={styles.certification}>외국어 인증, 사회봉사 미완료 <AppIcon name="chevron" /></p>
    <div className={styles.curve} role="img" aria-label={progress ? `졸업까지의 기간 진행률 ${progress.percentage.toFixed(2)}%` : "졸업 진행률 계산 중"}>
      <svg viewBox="0 0 300 86" preserveAspectRatio="none" aria-hidden="true">
        <defs><clipPath id={`curve-${curveId}`}><rect x="0" y="-10" width={300 * position} height="100" /></clipPath></defs>
        <path d="M0 80Q150 -40 300 80" fill="none" stroke="white" strokeOpacity=".5" strokeWidth="1.8" strokeDasharray="0 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d="M0 80Q150 -40 300 80" fill="none" stroke="white" strokeWidth="2" clipPath={`url(#curve-${curveId})`} vectorEffect="non-scaling-stroke" />
        <path d="M0 80H300M75 76v8M150 76v8M225 76v8" fill="none" stroke="white" strokeOpacity=".4" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className={styles.sun} style={{ left: `${position * 100}%`, top: `${sunY / 86 * 100}%` }}><WeatherIcon type="sunny" tone="hero" /></span>
    </div>
    <div className={styles.dates}><span>입학 {formatGraduationDate(dates.admission)}</span><strong>{!progress ? "졸업 D-—" : progress.remainingDays > 0 ? `졸업 D-${progress.remainingDays}` : progress.remainingDays === 0 ? "졸업 D-day" : `졸업 D+${Math.abs(progress.remainingDays)}`}</strong></div>
    <section className={styles.weather} aria-label="학기별 평점 날씨">
      <div className={styles.sectionHeading}><h2>학기별 평점</h2><HelpButton label="학기별 평점 날씨 기준 보기" tone="hero" onClick={() => semesterDialogRef.current?.showModal()} /></div>
      <div className={styles.semesters}>{semesters.map((semester) => <div key={semester.id} className={`${styles.semester} ${semester.current ? styles.current : ""}`} title={semester.gpa === null ? "설정된 평점이 없어요." : `${semester.gpa.toFixed(2)}점`}>
        <span>{semester.label}</span><WeatherIcon type={getWeatherType(semester.gpa)} tone="hero" />
      </div>)}</div>
    </section>
    <div className={styles.periods}>{DEMO_PERIODS.map((period) => {
      const percentage = progress ? calculatePeriodProgress(period.start, period.end, progress.timestamp) : null;
      return <section key={period.label}><div className={styles.periodHeading}><h2>{period.label === "학년도" ? yearLabel : period.label}</h2><span>{percentage === null ? "—" : percentage.toFixed(5)}<small>%</small></span></div><div className={styles.track}><span style={{ width: `${percentage ?? 0}%` }} /></div><p>{period.caption}</p></section>;
    })}</div>
    {/* 공통 메뉴와 같은 아이콘을 사용하며, 업로드 종류는 URL로 내 정보에 전달한다. */}
    <nav className={styles.shortcuts} aria-label="학업 바로가기">
      <Link href="/my?upload=grades"><AppIcon name="upload" /><span>성적표</span></Link>
      <Link href="/grades"><AppIcon name="chart" /><span>학점 계산</span></Link>
      <Link href="/degrees"><AppIcon name="award" /><span>디그리 신청</span></Link>
      <a href="https://portal.uos.ac.kr" target="_blank" rel="noopener noreferrer"><AppIcon name="external" /><span>포털</span></a>
    </nav>
    <GraduationProgressDialog dialogRef={progressDialogRef} dates={dates} />
    <SemesterGpaDialog dialogRef={semesterDialogRef} />
  </header>;
}
