"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { HelpButton } from "./help-button";
import { getSkyColors } from "./sky-colors";
import { AppIcon } from "./app-icon";
import { getWeatherType, WeatherIcon } from "./grade-weather";
import { calculatePeriodProgress, formatGraduationDate, getProfileGraduationDates, nextCalendarDate, useAcademicClock, useGraduationProgress } from "./graduation-progress";
import type { HomeOverview } from "./home-data";
import type { ExpectedGraduation } from "./api-client";
import { GraduationProgressDialog } from "./graduation-progress-dialog";
import { SemesterGpaDialog } from "./semester-gpa-dialog";
import styles from "./home-hero.module.css";

interface HomeHeroProps {
  student: string;
  admissionYear: number;
  graduation?: ExpectedGraduation | null;
  semesters: { id: string; label: string; current: boolean; gpa: number | null }[];
  certification: string[];
  calendar: HomeOverview["calendar"];
  studySemester: number;
}

export function HomeHero({ student, admissionYear, graduation, semesters, certification, calendar, studySemester }: HomeHeroProps) {
  const progressDialogRef = useRef<HTMLDialogElement>(null);
  const semesterDialogRef = useRef<HTMLDialogElement>(null);
  const dates = graduation ? getProfileGraduationDates({ admissionYear, ...graduation }) : null;
  const progress = useGraduationProgress(dates);
  const position = (progress?.percentage ?? 0) / 100;
  const sunY = 80 - 240 * position * (1 - position);
  const curveId = useId().replaceAll(":", "");
  const sky = getSkyColors(position * 100);

  return <header className={styles.hero} style={{ backgroundImage: `linear-gradient(180deg, ${sky.top}, ${sky.bottom})` }}>
    <div className={styles.heading}>
      <div><p className={styles.student}>{student}</p><h1>졸업 현황</h1></div>
      <HelpButton label="졸업 진행률 산정 기준 보기" tone="hero" large onClick={() => progressDialogRef.current?.showModal()} />
    </div>
    {/* 실제 지난 시간을 소수점 7자리로 표시한다. 임의로 숫자를 증가시키는 애니메이션이 아니다. */}
    <p className={styles.percentage}>{progress ? progress.percentage.toFixed(7) : "—"}{progress && <span>%</span>}</p>
    <Link href="/req" className={styles.certification}>{certification.length ? certification.join(" · ") : "졸업요건 확인"} <AppIcon name="chevron" /></Link>
    <div className={styles.curve} role="img" aria-label={progress ? `졸업까지의 기간 진행률 ${progress.percentage.toFixed(2)}%` : "졸업 진행률 계산 중"}>
      <svg viewBox="0 0 300 86" preserveAspectRatio="none" aria-hidden="true">
        <defs><clipPath id={`curve-${curveId}`}><rect x="0" y="-10" width={300 * position} height="100" /></clipPath></defs>
        <path d="M0 80Q150 -40 300 80" fill="none" stroke="white" strokeOpacity=".5" strokeWidth="1.8" strokeDasharray="0 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d="M0 80Q150 -40 300 80" fill="none" stroke="white" strokeWidth="2" clipPath={`url(#curve-${curveId})`} vectorEffect="non-scaling-stroke" />
        <path d="M0 80H300M75 76v8M150 76v8M225 76v8" fill="none" stroke="white" strokeOpacity=".4" vectorEffect="non-scaling-stroke" />
      </svg>
      {progress && <span className={styles.sun} style={{ left: `${position * 100}%`, top: `${sunY / 86 * 100}%` }}><WeatherIcon type="sunny" tone="hero" /></span>}
    </div>
    <div className={styles.dates}>
      <span>입학 {dates ? formatGraduationDate(dates.admission) : `${admissionYear}년`}</span>
      {progress ? <strong>{progress.remainingDays > 0 ? `졸업 D-${progress.remainingDays}` :
        progress.remainingDays === 0 ? "졸업 D-day" : `졸업 D+${Math.abs(progress.remainingDays)}`}</strong>
        : !dates && <Link href="/start?edit=1">졸업 예정 시기 설정</Link>}
    </div>
    <section className={styles.weather} aria-label="학기별 평점 날씨">
      <div className={styles.sectionHeading}><h2>학기별 평점</h2><HelpButton label="학기별 평점 날씨 기준 보기" tone="hero" onClick={() => semesterDialogRef.current?.showModal()} /></div>
      <div className={styles.semesters}>{semesters.map((semester) => <div key={semester.id} className={`${styles.semester} ${semester.current ? styles.current : ""}`} title={semester.gpa === null ? "등록된 평점이 없어요." : `${semester.gpa.toFixed(2)}점`}>
        <span>{semester.label}</span><WeatherIcon type={getWeatherType(semester.gpa)} tone="hero" />
        <span>{semester.gpa?.toFixed(2) ?? "—"}</span>
      </div>)}</div>
    </section>
    <div className={styles.periods}>
      <PeriodProgress label="이번 학기" start={calendar.opensOn} end={calendar.classesEndOn}
        note={calendar.classesEndOn ? `${formatGraduationDate(calendar.classesEndOn.slice(5))} 종강` : "등록된 일정 없음"} />
      <PeriodProgress label={`${Math.ceil(studySemester / 2)}학년`} start={`${calendar.academicTerm.year}-03-01`}
        end={new Date(Date.UTC(calendar.academicTerm.year + 1, 2, 0)).toISOString().slice(0, 10)}
        note={`${calendar.academicTerm.year + 1}년 2월 말까지`} />
    </div>
    <nav className={styles.shortcuts} aria-label="학업 바로가기">
      <Link href="/my#academic-files"><AppIcon name="upload" /><span>성적표</span></Link>
      <Link href="/grades?tab=planner"><AppIcon name="chart" /><span>학점 계산</span></Link>
      <Link href="/degrees"><AppIcon name="award" /><span>마이크로디그리</span></Link>
      <a href="https://portal.uos.ac.kr" target="_blank" rel="noopener noreferrer"><AppIcon name="external" /><span>포털</span></a>
    </nav>
    <GraduationProgressDialog dialogRef={progressDialogRef} dates={dates} />
    <SemesterGpaDialog dialogRef={semesterDialogRef} />
  </header>;
}

function PeriodProgress({ label, start, end, note }: { label: string; start?: string; end?: string; note: string }) {
  const now = useAcademicClock();
  const progress = now !== null && start && end ? calculatePeriodProgress(start, nextCalendarDate(end), now) : null;
  return <section>
    <div className={styles.periodHeading}><h2>{label}</h2><span>{progress === null ? "—" : <>{progress.toFixed(2)}<small>%</small></>}</span></div>
    <div className={styles.track} aria-hidden="true">{progress !== null && <span style={{ width: `${progress}%` }} />}</div>
    <p>{note}</p>
  </section>;
}
