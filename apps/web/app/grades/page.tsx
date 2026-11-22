"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./page.module.css";
import { useGradePlan } from "../grade-plan-provider";
import { GradeWeather as Weather } from "../grade-weather";
import { estimateFinalRank, GOALS, GRADES, validatePredictor } from "./grade-utils";
import type { GoalGrade, Grade, PredictorForm, RankEstimate } from "./grade-utils";
import { makePredictorForms } from "./sample-data";

const TABS = [{ id: "record", label: "성적 기록" }, { id: "planner", label: "플래너" }, { id: "predictor", label: "예측기" }] as const;
type Tab = (typeof TABS)[number]["id"];
const fmt = (value: number | null) => value === null ? "—" : value.toFixed(2);

function Help({ text }: { text: string }) {
  return <span className={styles.help} title={text} aria-label={text}>?</span>;
}

const paths = {
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  checklist: "m3 6 1 1 2-2M9 6h12M3 12l1 1 2-2M9 12h12M3 18l1 1 2-2M9 18h12",
  award: "M8 14 6 22l6-3 6 3-2-8M17 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  road: "M5 3v5c0 5 14 3 14 8v5M2 3h6M16 21h6",
  chart: "M4 20h17M7 16v-5M12 16V5M17 16V8",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21v-2a7 7 0 0 1 14 0v2",
};
const navigation: { label: string; icon: keyof typeof paths; href?: string }[] = [
  { label: "홈", icon: "home", href: "/" }, { label: "졸업요건", icon: "checklist" },
  { label: "디그리", icon: "award" }, { label: "로드맵", icon: "road" },
  { label: "학점", icon: "chart", href: "/grades" }, { label: "내 정보", icon: "user", href: "/my" },
];

// 표시 숫자를 별도로 적지 않고 성적 목록에서 구한 합계로 그래프를 그린다.
function HistoryChart({ mode }: { mode: "gpa" | "credits" }) {
  const { data, semesterSummaries } = useGradePlan();
  const HISTORY = data.history;
  if (!HISTORY.length) return <p className={styles.hint}>등록된 성적이 없어요.</p>;
  const values = semesterSummaries.map((summary) => mode === "gpa" ? summary.gpa ?? 0 : summary.earnedCredits);
  const low = mode === "gpa" ? Math.max(0, Math.floor((Math.min(...values) - .3) * 2) / 2) : 0;
  const high = mode === "gpa" ? 4.5 : Math.max(24, Math.ceil(Math.max(...values) / 6) * 6);
  const x = (index: number) => HISTORY.length === 1 ? 216 : 48 + index * 336 / Math.max(1, HISTORY.length - 1);
  const y = (value: number) => 164 - (value - low) / (high - low) * 112;
  const ticks = mode === "gpa" ? Array.from({ length: Math.round((high - low) / .5) + 1 }, (_, i) => low + i * .5) : Array.from({ length: high / 6 + 1 }, (_, i) => i * 6);
  return (
    <svg className={styles.historyChart} viewBox="0 0 416 202" role="img" aria-label={mode === "gpa" ? "학기별 평점 추이" : "학기별 유효 취득학점"}>
      {ticks.map((tick) => <g key={tick}><line x1="40" x2="394" y1={y(tick)} y2={y(tick)} stroke="var(--line)" /><text x="4" y={y(tick) + 4} className={styles.chartLabel}>{mode === "gpa" ? tick.toFixed(1) : tick}</text></g>)}
      {mode === "gpa" && <polyline points={values.map((value, index) => `${x(index)},${y(value)}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.5" />}
      {values.map((value, index) => <g key={HISTORY[index].id}>
        {mode === "gpa" ? <circle cx={x(index)} cy={y(value)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" /> : <rect x={x(index) - 14} y={y(value)} width="28" height={164 - y(value)} rx="4" fill="var(--accent)" opacity={index === values.length - 1 ? 1 : .55} />}
        <text x={x(index)} y={y(value) - 10} textAnchor="middle" className={styles.chartValue}>{mode === "gpa" ? value.toFixed(2) : value}</text>
        <text x={x(index)} y="190" textAnchor="middle" className={styles.chartLabel}>{HISTORY[index].id}</text>
      </g>)}
    </svg>
  );
}

const weightFields = [{ key: "attendanceWeight", label: "출석" }, { key: "assignmentWeight", label: "과제" }, { key: "midtermWeight", label: "중간고사" }, { key: "finalWeight", label: "기말고사" }] as const;
const cutoffFields = [{ key: "cutoffAPlus", label: "A+" }, { key: "cutoffA0", label: "A0" }, { key: "cutoffBPlus", label: "B+" }, { key: "cutoffB0", label: "B0" }] as const;

// 출석·과제의 득점/만점 입력을 재사용한다. 빈 득점은 기본값 적용 대상으로 남긴다.
function ScoreRow({ label, scoreKey, maxKey, form, onChange }: {
  label: string; scoreKey: keyof PredictorForm; maxKey: keyof PredictorForm;
  form: PredictorForm; onChange: (key: keyof PredictorForm, value: string) => void;
}) {
  return <div className={styles.inputRow}>
    <label htmlFor={scoreKey}>{label}</label>
    <div className={styles.fraction}>
      <input id={scoreKey} type="number" min="0" step="any" value={form[scoreKey]} placeholder="기본값" aria-label={`${label} 점수`} onChange={(event) => onChange(scoreKey, event.target.value)} />
      <span>/</span>
      <input id={maxKey} type="number" min="0.01" step="any" value={form[maxKey]} aria-label={`${label} 만점`} onChange={(event) => onChange(maxKey, event.target.value)} />
    </div>
  </div>;
}

function rankText(result: RankEstimate) {
  return result.status === "rank" ? `${result.rank}등 이내` : result.status === "any" ? "등수 제한 없음" : "가정상 달성 어려움";
}

export default function GradesPage() {
  // 목표·고정값과 성적 데이터는 루트에서 공유해 홈 날씨와 같은 값을 표시한다.
  const { data, previous, previousMajor, semesterSummaries, currentCredits,
    target, locks, setTarget, setLocks, plan, forecast, resetPlan } = useGradePlan();
  const HISTORY = data.history;
  const CURRENT_COURSES = data.currentCourses;
  const CURRENT_SEMESTER = data.currentSemester;
  // 탭·예측기 입력은 페이지에서, 목표와 고정 성적은 공유 Provider에서 관리한다.
  // API·localStorage에는 저장하지 않으므로 새로고침하면 예시값으로 돌아간다.
  const [tab, setTab] = useState<Tab>("record");
  const [chartMode, setChartMode] = useState<"gpa" | "credits">("gpa");
  const [semesterIndex, setSemesterIndex] = useState(HISTORY.length - 1);
  const [courseId, setCourseId] = useState(CURRENT_COURSES.find((course) => course.id === "network")?.id ?? CURRENT_COURSES[0]?.id ?? "");
  const [forms, setForms] = useState(() => makePredictorForms(CURRENT_COURSES));
  const [goals, setGoals] = useState<Record<string, GoalGrade>>({});

  const selectedIndex = Math.max(0, Math.min(semesterIndex, HISTORY.length - 1));
  const semester = HISTORY[selectedIndex];
  const semesterSummary = semesterSummaries[selectedIndex];
  const selectedCourse = CURRENT_COURSES.find((course) => course.id === courseId)!;
  const form = forms[courseId];
  const goal = goals[courseId] ?? "B+";
  const validation = form ? validatePredictor(form) : { ok: false as const, errors: { course: "수강 내역을 먼저 등록해주세요." } };
  const input = validation.ok ? validation.value : null;
  const result = input ? estimateFinalRank(input, goal) : null;

  function changeForm(key: keyof PredictorForm, value: string) {
    // 과목별로 별도 입력값을 보관해 과목을 바꿔도 다른 과목의 점수가 섞이지 않는다.
    setForms((previous) => ({ ...previous, [courseId]: { ...previous[courseId], [key]: value } }));
  }
  function openPredictor(id: string, grade: Grade) {
    setCourseId(id);
    setGoals((previous) => ({ ...previous, [id]: GOALS.includes(grade as GoalGrade) ? grade as GoalGrade : "B+" }));
    setTab("predictor");
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <p>{CURRENT_SEMESTER}학기 {currentCredits}학점 수강 중</p>
      <h1>학점</h1>
      <span className={styles.headerWeather}><Weather gpa={previous.gpa} /></span>
      <div className={styles.headerGpa}><strong>전체 평점 {fmt(previous.gpa)}</strong><span>전공 {fmt(previousMajor.gpa)}</span></div>
    </header>
    <div className={styles.content}>
      <div className={styles.tabs} role="tablist" aria-label="학점 메뉴">
        {TABS.map((item, index) => <button key={item.id} id={`tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={(event) => {
          // 탭은 마우스뿐 아니라 방향키·Home·End로도 이동할 수 있다.
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
          else if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = TABS.length - 1;
          else return;
          event.preventDefault(); setTab(TABS[next].id);
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>{item.label}</button>)}
      </div>
      <p className={styles.demoNote}>예시 성적·강의 데이터로 체험 중</p>

      <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "record" && <div className={styles.recordGrid}>
          <section className={styles.card}>
            <div className={styles.cardHeading}><h2>학기별 기록 <Help text="유효 성적을 기준으로 계산하며, P와 재수강 대체 전 성적은 평점에서 제외해요." /></h2>
              <div className={styles.smallTabs}><button type="button" aria-pressed={chartMode === "gpa"} onClick={() => setChartMode("gpa")}>평점</button><button type="button" aria-pressed={chartMode === "credits"} onClick={() => setChartMode("credits")}>이수학점</button></div>
            </div>
            <div className={styles.weatherStrip}>{semesterSummaries.map((summary, index) => <div key={HISTORY[index].id}><Weather gpa={summary.gpa} /><span>{HISTORY[index].id}</span></div>)}</div>
            <HistoryChart mode={chartMode} />
            <p className={styles.hint}>재수강 대체 전 성적은 집계에서 제외하며, P는 취득학점에만 포함해요.</p>
          </section>
          {semester && semesterSummary && <section className={styles.card}>
            <div className={styles.semesterHeading}>
              <button type="button" className={styles.roundButton} disabled={selectedIndex === 0} aria-label="이전 학기" onClick={() => setSemesterIndex(selectedIndex - 1)}>‹</button>
              <h2>{semester.id}</h2><span className={styles.semesterWeather}><Weather gpa={semesterSummary.gpa} /></span>
              <button type="button" className={styles.roundButton} disabled={selectedIndex === HISTORY.length - 1} aria-label="다음 학기" onClick={() => setSemesterIndex(selectedIndex + 1)}>›</button>
              <p>평점 <strong>{fmt(semesterSummary.gpa)}</strong>, {semesterSummary.earnedCredits}학점</p>
            </div>
            {semester.courses.map((course) => <article key={course.id} className={`${styles.courseRow} ${!course.valid ? styles.excluded : ""}`}>
              <div className={styles.courseText}><h3>{course.name}</h3><p>{course.category} {course.credits}학점{course.retake ? ", 재수강" : ""}{!course.valid ? " · 대체 전 성적, 집계 제외" : course.grade === "P" ? " · 평점 제외" : ""}</p></div>
              <strong className={styles.courseGrade}>{course.grade}</strong>
            </article>)}
          </section>}
        </div>}

        {tab === "planner" && CURRENT_COURSES.length === 0 && <section className={styles.card}>수강 내역이 등록되면 목표 평점을 설정할 수 있어요.</section>}
        {tab === "planner" && CURRENT_COURSES.length > 0 && <div className={styles.plannerGrid}>
          <div className={styles.column}>
            <section className={styles.card}>
              <div className={styles.cardHeading}><h2>이번 학기 목표 평점 <Help text="목표 이상을 충족하는 성적 조합을 제안해요. 고정한 과목 성적은 유지돼요." /></h2></div>
              <output className={styles.targetNumber} htmlFor="semester-target">{target.toFixed(2)}</output>
              <input id="semester-target" className={styles.range} type="range" min="2" max="4.5" step="0.05" value={target} aria-label="이번 학기 목표 평점" onChange={(event) => setTarget(Number(event.target.value))} />
              <div className={styles.rangeLabels}><span>2.00</span><span>4.50</span></div>
              <div className={styles.forecast}><p>제안 성적을 받으면 누적 평점</p><div><span>{fmt(previous.gpa)}</span><span>→</span><strong>{fmt(forecast)}</strong></div></div>
              {plan.possible && <p className={styles.hint}>제안 조합의 이번 학기 평점 {fmt(plan.summary.gpa)}를 반영했어요.</p>}
              <button type="button" className={styles.textButton} onClick={resetPlan}>목표와 고정 성적 초기화</button>
            </section>
            <section className={styles.card} aria-live="polite">
              <h2>{plan.possible ? "목표 달성 예시 조합" : "고정 조건에서 목표 달성 불가"}</h2>
              {plan.possible ? <>
                <div className={styles.groupSummary}><div><span>전공 예상</span><strong>{fmt(plan.major.gpa)}</strong></div><div><span>교양·일반선택 예상</span><strong>{fmt(plan.general.gpa)}</strong></div></div>
                <p className={styles.hint}>가능한 조합 중 하나예요. 미고정 과목은 C0 이상에서 제안하며, 졸업·이수 조건은 별도예요.</p>
              </> : <p className={styles.error}>나머지 과목을 모두 A+로 받아도 이번 학기 최대 {fmt(plan.highestGpa)}예요. 고정 성적이나 목표를 조정해주세요.</p>}
            </section>
          </div>
          <section className={styles.card}>
            <div className={styles.cardHeading}><h2>과목별 목표 <Help text="고정을 누르면 원하는 등급을 선택할 수 있어요. 예측은 해당 과목의 기말 등수 추정으로 이동해요." /></h2><span className={styles.hint}>{currentCredits}학점</span></div>
            {CURRENT_COURSES.map((course) => <div key={course.id} className={styles.planRow}>
              <div className={styles.courseText}><h3>{course.name}</h3><p>{course.category} {course.credits}학점</p></div>
              <button type="button" className={styles.lockButton} aria-pressed={Boolean(locks[course.id])} aria-label={`${course.name} 성적 고정`} onClick={() => setLocks((previous) => ({ ...previous, [course.id]: previous[course.id] ? null : plan.assignments[course.id] ?? "A0" }))}>고정</button>
              <div className={styles.gradeControl}>
                {locks[course.id] ? <select aria-label={`${course.name} 고정 성적`} value={locks[course.id]!} onChange={(event) => setLocks((previous) => ({ ...previous, [course.id]: event.target.value as Grade }))}>{GRADES.map((grade) => <option key={grade}>{grade}</option>)}</select> : <strong>{plan.possible ? `${plan.assignments[course.id]} 이상` : "—"}</strong>}
                <button type="button" className={styles.textButton} onClick={() => openPredictor(course.id, plan.assignments[course.id])}>예측</button>
              </div>
            </div>)}
          </section>
        </div>}

        {tab === "predictor" && !selectedCourse && <section className={styles.card}>수강 내역을 먼저 등록해주세요.</section>}
        {tab === "predictor" && selectedCourse && form && <div className={styles.predictorGrid}>
          <div className={styles.column}>
            <section className={styles.card}>
              <div className={styles.inputRow}><label htmlFor="predict-course">과목</label><select id="predict-course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>{CURRENT_COURSES.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></div>
              <div className={styles.cardHeading}><h2>평가 비율</h2><span className={styles.hint}>예시 · 아래에서 수정 가능</span></div>
              <div className={styles.weightSummary}>{weightFields.map((field) => <div key={field.key}><span>{field.label}</span><strong>{form[field.key] || "—"}%</strong></div>)}</div>
              <div className={styles.inputRow}><label htmlFor="enrollment">수강 인원</label><input id="enrollment" type="number" min="2" max="10000" step="1" value={form.enrollment} required onChange={(event) => changeForm("enrollment", event.target.value)} /></div>
              <ScoreRow label="출석" scoreKey="attendanceScore" maxKey="attendanceMax" form={form} onChange={changeForm} />
              <ScoreRow label="과제" scoreKey="assignmentScore" maxKey="assignmentMax" form={form} onChange={changeForm} />
              <div className={styles.inputRow}><label htmlFor="mid-rank">중간고사 등수 <span className={styles.required}>필수</span></label><div className={styles.fraction}><input id="mid-rank" type="number" min="1" max={Number(form.enrollment) || undefined} step="1" required value={form.midRank} aria-invalid={!validation.ok && Boolean(validation.errors.midRank)} onChange={(event) => changeForm("midRank", event.target.value)} /><span>/</span><span>{form.enrollment || "—"}명</span></div></div>
              {!validation.ok && <ul className={styles.errors} aria-live="polite">{Object.entries(validation.errors).map(([key, message]) => <li key={key}>{message}</li>)}</ul>}
              {validation.ok && validation.defaults.length > 0 && <p className={styles.hint}>기본값 적용: {validation.defaults.join(", ")}</p>}
            </section>
            <details className={`${styles.card} ${styles.assumptions}`}>
              <summary>참고 추정의 계산 가정·평가 비율 수정</summary>
              <p>원본 HTML의 간이 모형을 사용해요. 실제 등급 배분이나 점수 분포를 반영한 성적 보장은 아니에요.</p>
              <p>중간 등수는 등수 ÷ 인원 × 100, 출석은 100 − 득점률, 과제는 (100 − 득점률) × 2를 5~95 범위로 바꾼 뒤 평가 비율로 합산해요.</p>
              <h3>평가 비율 · 합계 100%</h3>
              <div className={styles.assumptionGrid}>{weightFields.map((field) => <label key={field.key}>{field.label}<input type="number" min="0" max="100" step="any" value={form[field.key]} onChange={(event) => changeForm(field.key, event.target.value)} /></label>)}</div>
              <h3>등급별 누적 상위 비율 · 예시</h3>
              <div className={styles.assumptionGrid}>{cutoffFields.map((field) => <label key={field.key}>{field.label}<input type="number" min="0.01" max="100" step="any" value={form[field.key]} onChange={(event) => changeForm(field.key, event.target.value)} /></label>)}</div>
              <p>학교의 공식 비율이 아니며 과목별로 확인해야 해요. 중간 등수는 필수이고, 출석·과제 점수를 비우면 각각 100%·80%를 사용해요.</p>
              <button type="button" className={styles.textButton} onClick={() => setForms((previous) => ({ ...previous, [courseId]: makePredictorForms(CURRENT_COURSES)[courseId] }))}>이 과목의 예시 입력으로 초기화</button>
            </details>
          </div>
          <div className={styles.column}>
            <section className={styles.card} aria-live="polite">
              <div className={styles.goalTabs} role="group" aria-label="목표 등급">{GOALS.map((grade) => <button key={grade} type="button" aria-pressed={goal === grade} onClick={() => setGoals((previous) => ({ ...previous, [courseId]: grade }))}>{grade}</button>)}</div>
              <span className={styles.referenceBadge}>참고 추정</span>
              <p className={styles.resultTitle}>{selectedCourse.name} {goal}에 필요한 기말 등수</p>
              <p className={styles.resultNumber}>{result ? rankText(result) : "입력값을 확인해주세요"}</p>
              <p className={styles.resultDescription}>{result && input ? result.status === "rank" ? `${input.enrollment}명 중 상위 ${result.percentage.toFixed(1)}%` : result.status === "any" ? "입력한 가정에서는 현재 점수로 충족해요." : "입력한 가정에서는 기말 1등이어도 미달해요." : "유효한 값을 입력하면 추정 결과가 표시돼요."}</p>
            </section>
            <section className={styles.card}>
              <h2>내 위치 <Help text="예시 등급 비율 위에 중간 등수와 기말 목표 위치를 함께 표시해요. 현재 확정 등급을 뜻하지 않아요." /></h2>
              {input && result ? <div className={styles.positionChart}>
                <div className={styles.zones}>{[...GOALS.map((grade, index) => ({ label: grade, width: input.cutoffs[grade] - (index ? input.cutoffs[GOALS[index - 1]] : 0) })), { label: "C 이하", width: 100 - input.cutoffs.B0 }].map((zone, index) => <div key={zone.label} className={styles[`zone${index}`]} style={{ width: `${zone.width}%` }}>{zone.width >= 8 ? zone.label : ""}</div>)}</div>
                {result.status === "rank" && <span className={styles.goalPin} style={{ left: `clamp(38px, ${result.percentage}%, calc(100% - 38px))` }}>기말 {result.rank}등</span>}
                <span className={styles.midPin} style={{ left: `clamp(42px, ${input.midRank / input.enrollment * 100}%, calc(100% - 42px))` }}>▲ 중간 {input.midRank}등</span>
              </div> : <p className={styles.hint}>입력값을 확인하면 위치를 표시해요.</p>}
            </section>
            <section className={styles.card}>
              <h2>학점별 필요 등수 <Help text="입력한 평가 비율과 예시 등급 컷을 동일하게 적용한 참고 추정이에요." /></h2>
              <table className={styles.rankTable}><caption className={styles.srOnly}>목표 등급별 기말 등수 참고 추정</caption><thead className={styles.srOnly}><tr><th scope="col">등급</th><th scope="col">필요 등수</th></tr></thead><tbody>{GOALS.map((grade) => {
                const estimate = input ? estimateFinalRank(input, grade) : null;
                return <tr key={grade} className={grade === goal ? styles.selectedRank : undefined}><th scope="row">{grade}</th><td>{estimate ? rankText(estimate) : "—"}</td></tr>;
              })}</tbody></table>
            </section>
          </div>
        </div>}
      </section>
    </div>
    <nav className={styles.bottomNav} aria-label="주 메뉴">{navigation.map((item) => {
      const content = <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[item.icon]} /></svg><span>{item.label}</span></>;
      return item.href ? <Link key={item.label} href={item.href} className={item.href === "/grades" ? styles.activeNav : undefined} aria-current={item.href === "/grades" ? "page" : undefined}>{content}</Link> : <button key={item.label} type="button" disabled>{content}</button>;
    })}</nav>
  </main>;
}
