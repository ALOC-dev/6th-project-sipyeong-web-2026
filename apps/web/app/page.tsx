"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, displayNumber, type ExpectedGraduation } from "./api-client";
import { AppIcon } from "./app-icon";
import { HelpButton } from "./help-button";
import { HomeHelpDialog, type HomeHelpKind } from "./home-help-dialog";
import { HomeHero } from "./home-hero";
import { getHomeSemesters, loadHome, regularTerm, requirementLabel, requirementProgress } from "./home-data";
import { forecastTargetGpa } from "./grades/grade-utils";
import { evenSplit, futureTerms, recommend, requirementPlans, type Roadmap } from "./plan-data";
import { useSemesterTarget } from "./semester-target";
import { formatGraduationPeriod, getRemainingSemesterCount } from "./profile-model";
import { useApi } from "./use-api";
import styles from "./home.module.css";

async function loadRecommendations(signal: AbortSignal) {
  return (await api<Roadmap>("me/roadmap", { signal })).data;
}

function UpcomingCourses({ graduation }: { graduation: ExpectedGraduation }) {
  const { data, error, reload } = useApi(loadRecommendations);
  const terms = data ? futureTerms(data.currentTerm, graduation) : [];
  const remaining = data && requirementPlans(data, []).find(rule => rule.type === "total_credits")?.remaining;
  const courses = useMemo(() => {
    if (!data?.hasRecords) return [];
    const future = futureTerms(data.currentTerm, graduation);
    return future.length ? recommend(data, future, evenSplit(future, remaining ?? 0))[0].courses.slice(0, 3) : [];
  }, [data, graduation, remaining]);
  return <section className={styles.card}>
    <div className={styles.cardHeading}>
      <h2>{terms[0] ? `${terms[0]} 추천 과목` : "다음 학기 추천 과목"}</h2>
      <Link href="/road" className={styles.cardMore}>로드맵<AppIcon name="chevron" /></Link>
    </div>
    {courses.length > 0 ? <ul className={styles.coursePreview}>
      {courses.map(course => <li key={course.code}><b>{course.name}</b><span>{course.category} · {course.credits}학점</span></li>)}
    </ul> : error ? <p className={styles.description}>추천 과목을 불러오지 못했어요. <button type="button" onClick={reload}>다시 시도</button></p>
      : <p className={styles.description}>{data ? "추천을 확인하려면 로드맵에서 다음 학기 계획을 열어보세요." : "추천 과목을 불러오는 중…"}</p>}
  </section>;
}

export default function Home() {
  const router = useRouter();
  const { data, error, reload } = useApi(loadHome);
  const [help, setHelp] = useState<HomeHelpKind | null>(null);
  const incomplete = data?.account.me.profileCompleted === false;

  useEffect(() => {
    if (incomplete) router.replace("/start");
  }, [incomplete, router]);

  const profile = data?.account.me.profile;
  const overview = data?.overview;
  const [target] = useSemesterTarget(data?.account.me.userId ?? "", overview?.currentTerm ?? { year: 0, termCode: "" });
  if (!profile || !overview || !data) {
    return <main className={styles.page}>
      <section className={styles.card}>
        <h1>시평</h1>
        {error ? <><p role="alert">{error}</p><button type="button" onClick={reload}>다시 시도</button></>
          : <p role="status">학업 정보를 불러오는 중…</p>}
      </section>
    </main>;
  }

  const department = data.account.departments.find(item => item.departmentId === profile.departmentId);
  const term = regularTerm(overview.currentTerm.termCode);
  const currentSemester = `${overview.currentTerm.year}-${term}`;
  const graduation = profile.expectedGraduation ?? profile.estimatedGraduation;
  const remaining = graduation ? getRemainingSemesterCount(currentSemester, graduation.graduationYear, graduation.graduationMonth) : null;
  const requirements = overview.graduation.requirements.filter(rule =>
    rule.unit === "credits" && rule.status !== "met" && rule.currentValue !== null && rule.requiredValue !== null);
  const certification = overview.graduation.requirements
    .filter(rule => rule.status !== "met" && ["language_certification", "volunteer"].includes(rule.type))
    .map(rule => `${rule.title} 확인 필요`);
  const classesEnd = overview.calendar.academicTerm.year === overview.currentTerm.year &&
    overview.calendar.academicTerm.termCode === overview.currentTerm.termCode
    ? overview.calendar.classesEndOn?.slice(5).replace("-", ".") : undefined;
  const forecast = forecastTargetGpa(overview.gpa.basis, overview.currentSemester.credits, target);
  const summary = [
    { label: "평점", detail: overview.gpa.major === null ? "전공 평점 자료 없음" : `전공 ${displayNumber(overview.gpa.major, 2)}`,
      value: displayNumber(overview.gpa.overall, 2), href: "/grades" },
    { label: overview.credits.recognized === null ? "취득 학점" : "졸업 인정 학점",
      detail: overview.credits.recognized !== null ? `취득 ${overview.credits.earned}학점` :
        overview.credits.recognition ? "졸업 인정 학점 확인 필요" : "졸업 인정 학점 산정 기준 준비 중",
      value: displayNumber(overview.credits.recognized ?? overview.credits.earned, undefined, "학점"), href: "/req#recognized-credits" },
    { label: "이번 학기", detail: [`${overview.currentSemester.courseCount}과목`, classesEnd && `${classesEnd} 종강`].filter(Boolean).join(" · "),
      value: `${overview.currentSemester.credits}학점`, href: "/grades?tab=planner" },
    { label: "남은 학기", detail: graduation ? `${formatGraduationPeriod(graduation)} 졸업 예정` : "졸업 예정 시기 확인 필요",
      value: displayNumber(remaining, undefined, "학기"), href: "/start?edit=1" },
  ];

  return <main className={styles.page}>
    <HomeHero student={[department?.name, `${profile.admissionYear}학번`, `${overview.currentTerm.year}년 ${term}학기`].filter(Boolean).join(" · ")}
      admissionYear={profile.admissionYear} graduation={graduation}
      semesters={getHomeSemesters(overview, target)}
      certification={certification} calendar={overview.calendar} studySemester={profile.studySemester} />

    <div className={styles.content}>
      <div className={styles.primaryColumn}>
        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <h2>요약 <HelpButton label="요약 기준 보기" onClick={() => setHelp("summary")} /></h2>
            <Link href="/grades" className={styles.cardMore}>성적 기록<AppIcon name="chevron" /></Link>
          </div>
          <div className={styles.summaryList}>
            {summary.map(item => <Link className={styles.summaryRow} key={item.label} href={item.href}>
              <span><span className={styles.summaryLabel}>{item.label}</span><span className={styles.description}>{item.detail}</span></span>
              <strong>{item.value}</strong><AppIcon name="chevron" className={styles.chevron} />
            </Link>)}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <h2>남은 졸업요건 <HelpButton label="졸업요건 진행률 기준 보기" onClick={() => setHelp("requirements")} /></h2>
            <Link href="/req" className={styles.cardMore}>전체<AppIcon name="chevron" /></Link>
          </div>
          {!overview.graduation.requirementSet ? <p className={styles.description}>적용할 졸업요건이 아직 등록되지 않았어요.</p>
            : requirements.length === 0 && <p className={styles.description}>상세 판정은 졸업요건 탭에서 확인할 수 있어요.</p>}
          {requirements.map(rule => {
            const current = requirementProgress(rule.currentValue, rule.requiredValue);
            const projected = requirementProgress(rule.projectedValue, rule.requiredValue);
            return <Link href={`/req#rule-${encodeURIComponent(rule.code)}`} key={rule.code} className={styles.requirement}>
              <div className={styles.requirementRow}>
                <span>{rule.title}</span>
                <strong className={rule.status === "expected" ? styles.blueText : undefined}>{requirementLabel(rule)}</strong>
                <AppIcon name="chevron" className={styles.chevron} />
              </div>
              <div className={styles.requirementProgress}>
                <span>{rule.currentValue}학점</span>
                <div className={styles.requirementTrack} aria-hidden="true">
                  <span className={styles.plannedFill} style={{ width: `${projected}%` }} />
                  <span className={styles.earnedFill} style={{ width: `${current}%` }} />
                </div>
                <span>{rule.requiredValue}학점</span>
              </div>
            </Link>;
          })}
        </section>
      </div>

      <div className={styles.secondaryColumn}>
        {graduation && <UpcomingCourses graduation={graduation} />}
        <Link href="/degrees" className={`${styles.card} ${styles.degreeCard}`}>
          <h2>마이크로디그리</h2>
          <AppIcon name="chevron" className={styles.chevron} />
        </Link>

        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <h2>누적 평점 <HelpButton label="누적 평점 안내 보기" onClick={() => setHelp("gpa")} /></h2>
            <Link href="/grades?tab=planner" className={styles.cardMore}>플래너<AppIcon name="chevron" /></Link>
          </div>
          <p className={styles.gpaChange}>
            <span aria-label="현재 누적 평점">{displayNumber(overview.gpa.overall, 2)}</span>
            {forecast !== null && <><span aria-hidden="true">→</span><strong aria-label="예상 누적 평점">{forecast.toFixed(2)}</strong></>}
          </p>
          <p className={styles.description}>{forecast !== null
            ? `이번 학기 목표 ${target.toFixed(2)} · ${overview.currentSemester.credits}학점 반영`
            : overview.currentSemester.credits > 0 ? "평점 산정에 필요한 성적 자료가 없어요." : "이번 학기 수강 과목을 등록하면 예상 평점을 볼 수 있어요."}</p>
        </section>
      </div>
    </div>
    {help && <HomeHelpDialog kind={help} onClose={() => setHelp(null)} />}
  </main>;
}
