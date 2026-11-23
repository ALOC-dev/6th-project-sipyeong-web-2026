"use client";

import { AcademicNav } from "../academic-nav";
import { api, displayNumber } from "../api-client";
import { useApi } from "../use-api";
import styles from "../page.module.css";

const statuses = { met: "충족", expected: "충족 예정", unmet: "미충족", unknown: "판정 보류" };
const units = { hours: "시간", credits: "학점", courses: "과목" };

interface Graduation {
  status: keyof typeof statuses;
  requirementSet: { requirement_set_id: number } | null;
  progressPercent: number | null;
  remainingCredits: number | null;
  requirements: {
    code: string;
    title: string;
    status: keyof typeof statuses;
    unit: keyof typeof units | null;
    currentValue: number | null;
    requiredValue: number | null;
  }[];
}

async function loadGraduation(signal: AbortSignal) {
  return (await api<Graduation>("me/graduation", { signal })).data;
}

export default function RequirementsPage() {
  const { data, error, reload } = useApi(loadGraduation);
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>졸업요건</h1>
        {data && <p>졸업요건 {statuses[data.status]}</p>}
      </header>
      <div className={styles.content}>
        {error && <section className={styles.card}><p role="alert">{error}</p><button type="button" onClick={reload}>다시 시도</button></section>}
        {!error && !data && <p role="status">졸업요건을 불러오는 중…</p>}
        {data && <section className={styles.card}>
          <h2>학점 요건</h2>
          {!data.requirementSet && <p>학과와 입학연도에 적용할 졸업요건을 확인할 수 없습니다.</p>}
          {data.requirementSet && data.requirements.length === 0 && <p>등록된 졸업요건 항목이 없습니다.</p>}
          <dl className={styles.summaryList}>
            <div className={styles.summaryRow}><dt>학점 진행률</dt><dd>{displayNumber(data.progressPercent, undefined, "%")}</dd></div>
            <div className={styles.summaryRow}><dt>남은 학점</dt><dd>{displayNumber(data.remainingCredits, undefined, "학점")}</dd></div>
            {data.requirements.map((rule) => (
              <div className={styles.summaryRow} key={rule.code}>
                <dt>{rule.title}</dt>
                <dd>
                  {rule.unit && rule.requiredValue !== null && (
                    <span>{displayNumber(rule.currentValue)} / {rule.requiredValue}{units[rule.unit]} · </span>
                  )}
                  <strong>{statuses[rule.status]}</strong>
                </dd>
              </div>
            ))}
          </dl>
        </section>}
      </div>
      <AcademicNav current="/req" />
    </main>
  );
}
