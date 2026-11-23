"use client";

import Link from "next/link";
import { useEffect } from "react";
import { api, displayNumber } from "../api-client";
import { AppIcon } from "../app-icon";
import { WeatherIcon, type Sky } from "../weather-icon";
import { requirementLabel, requirementProgress, requirementStatus, requirementUnits } from "../home-data";
import type { Graduation, GraduationRequirement, HomeOverview } from "../home-data";
import { useApi } from "../use-api";
import shared from "../home.module.css";
import styles from "./page.module.css";

type GraduationDetail = Graduation & {
  profile: { department_name: string; curriculum_year: number | null } | null;
  credits: HomeOverview["credits"];
  remainingCredits: number | null;
};

async function loadGraduation(signal: AbortSignal) {
  return (await api<GraduationDetail>("me/graduation", { signal })).data;
}

function checklistOrder(rule: GraduationRequirement) {
  if (rule.code === "gpa") return 1;
  if (rule.type === "volunteer") return 2;
  if (rule.type === "language_certification") return 3;
  return 0;
}

const statusSky: Record<GraduationRequirement["status"], Sky> = {
  met: "sun", expected: "sunc", unmet: "cloud", unknown: "none",
};

function StatusIcon({ status }: { status: GraduationRequirement["status"] }) {
  return <span className={styles.statusIcon} data-status={status}><WeatherIcon sky={statusSky[status]} /></span>;
}

function ChecklistItem({ rule }: { rule: GraduationRequirement }) {
  const showProgress = rule.unit && rule.currentValue !== null && rule.requiredValue !== null;
  const inProgress = new Set(rule.enrolledCourses.map(course => course.course_id));
  const candidates = rule.status === "met" ? [] : rule.missingCourses.filter(course => !inProgress.has(course.course_id));
  const linkedProfile = rule.type === "volunteer" || rule.type === "language_certification";
  const heading = <>
    <StatusIcon status={rule.status} />
    <h3>{rule.title}</h3>
    <strong className={styles.status} data-status={rule.status}>
      {rule.status === "unmet" && rule.remaining !== null && rule.unit ? <><span>미충족</span><small>{requirementLabel(rule)}</small></>
        : requirementLabel(rule)}
    </strong>
  </>;

  return <article id={`rule-${rule.code}`} className={styles.rule}>
    {linkedProfile ? <Link href="/start?edit=1" className={styles.ruleHeading}>{heading}<AppIcon name="chevron" className={shared.chevron} /></Link>
      : <div className={styles.ruleHeading}>{heading}</div>}
    {showProgress && <div className={styles.progress} data-status={rule.status}>
      <span>{displayNumber(rule.currentValue)}</span>
      <div className={shared.requirementTrack} aria-hidden="true">
        <span className={shared.plannedFill} style={{ width: `${requirementProgress(rule.projectedValue, rule.requiredValue)}%` }} />
        <span className={`${shared.earnedFill} ${styles.progressEarned}`} style={{ width: `${requirementProgress(rule.currentValue, rule.requiredValue)}%` }} />
      </div>
      <span>{rule.requiredValue}{requirementUnits[rule.unit!]}</span>
    </div>}
    {rule.status !== "met" && rule.enrolledCourses.length > 0 &&
      <p className={styles.courseNote}><b>수강 중</b> {rule.enrolledCourses.map(course => course.course_name).join(", ")}</p>}
    {candidates.length > 0 && <details className={styles.candidates}>
      <summary>미이수 후보 과목 {candidates.length}개</summary>
      <ul>{candidates.map(course => <li key={course.course_id}>{course.course_name}</li>)}</ul>
    </details>}
  </article>;
}

export default function RequirementsPage() {
  const { data, error, reload } = useApi(loadGraduation);
  useEffect(() => {
    if (!data) return;
    const hash = window.location.hash.slice(1);
    const target = data.requirements.find(rule => hash === `rule-${encodeURIComponent(rule.code)}`);
    document.getElementById(target ? `rule-${target.code}` : hash)?.scrollIntoView();
  }, [data]);
  const curriculum = data?.profile?.curriculum_year;
  const source = data?.requirementSet?.source_ref;
  const recognition = data?.credits.recognition;
  return (
    <main className={shared.page}>
      <header className={styles.hero}>
        {data?.profile && <p>{data.profile.department_name}{curriculum && ` ${curriculum}학년도 교육과정`}</p>}
        <h1>졸업요건</h1>
        {data && <div className={styles.heroSummary}>
          <span>{data.requirementSet
            ? `충족 ${data.counts.met}개 · 이번 학기 수강 포함 ${data.counts.met + data.counts.expected}개`
            : "적용 기준 미등록"}</span>
          <span>{data.requirementSet && `전체 ${data.counts.total}개`}</span>
        </div>}
      </header>
      {error && <div className={shared.content}><section className={shared.card}><p role="alert">{error}</p><button type="button" onClick={reload}>다시 시도</button></section></div>}
      {!error && !data && <p className={styles.loading} role="status">졸업요건을 불러오는 중…</p>}
      {data && <div className={shared.content}>
        <section className={shared.card}>
          <div className={shared.cardHeading}><h2>체크리스트</h2>{data.requirementSet && <span className={shared.description}>{requirementStatus[data.status]}</span>}</div>
          {data.requirements.length ? [...data.requirements].sort((a, b) => checklistOrder(a) - checklistOrder(b))
            .map(rule => <ChecklistItem key={rule.code} rule={rule} />) :
            <p className={shared.description}>학과와 입학연도에 적용할 졸업요건이 등록되지 않았어요.</p>}
        </section>
        <aside className={styles.sidebar}>
          <section id="recognized-credits" className={shared.card}>
            <div className={shared.cardHeading}><h2>인정 학점 계산</h2></div>
            <dl className={styles.creditList}>
              <div><dt>성적표 기준 취득 학점</dt><dd>{displayNumber(data.credits.earned, undefined, "학점")}</dd></div>
              {recognition && <>
                <div><dt>교양 이수 / 인정 한도</dt><dd>{displayNumber(recognition.liberalEarned)} / {recognition.liberalLimit}학점</dd></div>
                <div><dt>교양 한도 초과 차감</dt><dd>{recognition.liberalExcess === null ? "확인 필요" : `${recognition.liberalExcess > 0 ? "−" : ""}${recognition.liberalExcess}학점`}</dd></div>
              </>}
              <div className={styles.recognized}><dt>졸업 인정 학점</dt><dd>{data.credits.recognized === null ? recognition ? "확인 필요" : "산정 기준 준비 중" : `${data.credits.recognized}학점`}</dd></div>
              {data.remainingCredits !== null && <div><dt>총 이수 기준 남은 학점</dt><dd>{data.remainingCredits}학점</dd></div>}
            </dl>
            {recognition && <p className={shared.description}>교양필수와 교양선택을 합산해 상한을 적용해요. 초과분은 졸업학점에서 차감되며 성적과 평점은 유지돼요.</p>}
            {recognition && data.credits.recognized === null && <p className={shared.description}>취득 학점이나 과목 이수구분을 확인하면 인정 학점을 계산할 수 있어요.</p>}
          </section>
          <Link href="/degrees" className={`${shared.card} ${shared.degreeCard}`}>
            <h2>마이크로디그리</h2><AppIcon name="chevron" className={shared.chevron} />
          </Link>
          <section id="graduation-sources" className={shared.card}>
            <div className={shared.cardHeading}><h2>기준 데이터</h2></div>
            {source && <p className={shared.description}>{source.startsWith("test:") ? "등록된 졸업요건은 시연용 기준이에요." : "등록된 학과별 졸업요건 기준을 적용해요."}</p>}
            {recognition && <a href={recognition.sourceUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>서울시립대 교양과목 이수 상한 기준<AppIcon name="chevron" className={shared.chevron} /></a>}
            <Link href="/my#academic-files" className={styles.sourceLink}>반영한 성적표·수강 내역 확인<AppIcon name="chevron" className={shared.chevron} /></Link>
          </section>
        </aside>
      </div>}
    </main>
  );
}
