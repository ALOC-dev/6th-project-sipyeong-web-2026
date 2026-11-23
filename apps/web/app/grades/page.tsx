"use client";

import { useState } from "react";
import { HelpButton } from "../help-button";
import { useGradePlan } from "../grade-plan-provider";
import { estimateFinalRank, GOALS, GRADES, validatePredictor } from "./grade-utils";
import type { GoalGrade, Grade, PredictorForm, RankEstimate } from "./grade-utils";
import { makePredictorForms } from "./sample-data";
import { getRelativeExclusion, getRelativeSegments } from "./relative-policy";
import { GradesHelpDialog } from "./grades-help-dialog";
import type { GradesHelpKind } from "./grades-help-dialog";
import { PredictorSettings, WEIGHT_FIELDS } from "./predictor-settings";
import { GradeRecords } from "./grade-records";
import styles from "./page.module.css";

const TABS = [{ id: "record", label: "성적 기록" }, { id: "planner", label: "플래너" }, { id: "predictor", label: "예측기" }] as const;
type Tab = (typeof TABS)[number]["id"];
const fmt = (value: number | null) => value === null ? "—" : value.toFixed(2);
const isGoal = (grade: Grade): grade is GoalGrade => GOALS.includes(grade as GoalGrade);

// 플래너의 작은 등수 안내와 예측기 본문이 똑같은 검증·계산 함수를 사용한다.
function predict(form: PredictorForm | undefined, goal: GoalGrade) {
  const validation = form ? validatePredictor(form) : { ok: false as const, errors: { course: "수강 내역을 먼저 등록해주세요." } };
  const exclusion = form ? getRelativeExclusion(Number(form.enrollment), form.courseType) : null;
  const input = validation.ok && !exclusion ? validation.value : null;
  return { validation, exclusion, input, result: input ? estimateFinalRank(input, goal) : null };
}

function rankText(result: RankEstimate) {
  return result.status === "excluded" ? "상대평가 적용 제외" : result.status === "rank" ? `${result.rank}등 이내` : result.status === "any" ? "등수 제한 없음" : "가정상 달성 어려움";
}

function ScoreRow({ label, scoreKey, maxKey, form, onChange }: {
  label: string; scoreKey: keyof PredictorForm; maxKey: keyof PredictorForm; form: PredictorForm;
  onChange: (key: keyof PredictorForm, value: string) => void;
}) {
  return <div className={styles.inputRow}>
    <label htmlFor={scoreKey}>{label}</label>
    <div className={styles.fraction}>
      <input id={scoreKey} type="number" min="0" step="any" value={form[scoreKey]} placeholder="기본값" aria-label={`${label} 점수`} onChange={(event) => onChange(scoreKey, event.target.value)} /><span>/</span>
      <input id={maxKey} type="number" min="0.01" step="any" value={form[maxKey]} aria-label={`${label} 만점`} onChange={(event) => onChange(maxKey, event.target.value)} />
    </div>
  </div>;
}

export default function GradesPage() {
  const { data, previous, target, locks, setTarget, setLocks, plan, forecast } = useGradePlan();
  const [tab, setTab] = useState<Tab>("record");
  const [courseId, setCourseId] = useState(data.currentCourses.find((course) => course.id === "network")?.id ?? data.currentCourses[0]?.id ?? "");
  const [forms, setForms] = useState(() => makePredictorForms(data.currentCourses));
  const [goals, setGoals] = useState<Record<string, GoalGrade>>({});
  const [help, setHelp] = useState<GradesHelpKind | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const defaults = makePredictorForms(data.currentCourses);
  const getForm = (id: string) => defaults[id] ? { ...defaults[id], ...forms[id] } : undefined;
  const selectedCourse = data.currentCourses.find((course) => course.id === courseId);
  const form = getForm(courseId);
  const goal = goals[courseId] ?? "B+";
  const { validation, exclusion, input, result } = predict(form, goal);
  const cutoffs = validation.ok ? validation.value.cutoffs : null;

  function changeForm(key: keyof PredictorForm, value: string) {
    // 과목을 바꿔도 각 과목의 점수·비율이 다른 과목에 섞이지 않는다.
    setForms((stored) => ({ ...stored, [courseId]: { ...defaults[courseId], ...stored[courseId], [key]: value } }));
  }
  function openPredictor(id: string, grade: GoalGrade) {
    setCourseId(id); setGoals((stored) => ({ ...stored, [id]: grade })); setTab("predictor");
  }

  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.headerTitle}><h1>학점</h1></div></header>
    <div className={styles.content}>
      <div className={styles.tabs} role="tablist" aria-label="학점 메뉴">{TABS.map((item, index) => <button key={item.id} id={`tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={(event) => {
        // 키보드 방향키·Home·End로도 탭을 바꿀 수 있다.
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
        else if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = TABS.length - 1;
        else return;
        event.preventDefault(); setTab(TABS[next].id);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}>{item.label}</button>)}</div>

      {/* PC는 1.35:1 두 열, 모바일은 같은 카드를 한 열로 쌓는다. */}
      <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "record" && <GradeRecords />}
        {tab !== "record" && data.source === "sample" && (
          <p className={styles.hint}>예시 과목과 성적을 사용한 모의 계산입니다.</p>
        )}

        {tab === "planner" && (data.currentCourses.length ? <div className={styles.plannerGrid}>
          <section className={styles.card}>
            <div className={styles.cardHeading}><h2>이번 학기 목표 평점<HelpButton label="목표 평점 설명 보기" onClick={() => setHelp("planner")} /></h2></div>
            <output className={styles.targetNumber} htmlFor="semester-target">{target.toFixed(2)}</output>
            <input id="semester-target" className={styles.range} type="range" min="2" max="4.5" step="0.05" value={target} aria-label="이번 학기 목표 평점" onChange={(event) => setTarget(Number(event.target.value))} />
            <div className={styles.forecast}><p>누적 평점</p><div><span>{fmt(previous.gpa)}</span><span className={styles.forecastArrow}>→</span><strong>{fmt(forecast)}</strong></div></div>
            {!plan.possible && <p className={styles.error}>고정 조건에서는 최대 {fmt(plan.highestGpa)}예요. 목표나 고정 성적을 조정해주세요.</p>}
          </section>
          <section className={styles.card}>
            <div className={styles.cardHeading}><h2>과목별 목표<HelpButton label="과목별 목표 설명 보기" onClick={() => setHelp("courses")} /></h2></div>
            {data.currentCourses.map((course) => {
              const assigned = plan.assignments[course.id];
              const forecastRank = isGoal(assigned) ? predict(getForm(course.id), assigned) : null;
              return <div key={course.id} className={styles.planRow}>
                <div className={styles.courseText}><h3>{course.name}</h3><p>{course.category} {course.credits}학점</p></div>
                <button type="button" className={styles.lockButton} aria-pressed={Boolean(locks[course.id])} aria-label={`${course.name} 성적 고정`} onClick={() => setLocks((stored) => ({ ...stored, [course.id]: stored[course.id] ? null : assigned ?? "A0" }))}>고정</button>
                <div className={styles.gradeControl}>
                  {locks[course.id] ? <select aria-label={`${course.name} 고정 성적`} value={locks[course.id]!} onChange={(event) => setLocks((stored) => ({ ...stored, [course.id]: event.target.value as Grade }))}>{GRADES.map((grade) => <option key={grade}>{grade}</option>)}</select>
                    : plan.possible && isGoal(assigned) ? <button type="button" className={styles.gradeLink} aria-label={`${course.name} ${assigned} 목표 기말 등수 예측`} onClick={() => openPredictor(course.id, assigned)}><strong>{assigned} 이상</strong><small>{forecastRank?.exclusion ? "상대평가 적용 제외" : forecastRank?.result ? `기말 ${rankText(forecastRank.result)}` : "예측 입력 확인"}</small></button>
                      : <><strong>{plan.possible ? `${assigned} 이상` : "—"}</strong>{plan.possible && <small>A·B등급 예측 지원</small>}</>}
                </div>
              </div>;
            })}
          </section>
        </div> : <section className={styles.card}>수강 내역이 등록되면 목표 평점을 설정할 수 있어요.</section>)}

        {tab === "predictor" && (!selectedCourse || !form ? <section className={styles.card}>수강 내역을 먼저 등록해주세요.</section> : <div className={styles.predictorGrid}>
          <section className={styles.card}>
            <div className={styles.inputRow}><label htmlFor="predict-course">과목</label><select id="predict-course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>{data.currentCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></div>
            <div className={styles.weightBox}>
              <div className={styles.weightHeading}><h2>평가 비율</h2><button type="button" className={styles.textButton} aria-haspopup="dialog" onClick={() => setShowSettings(true)}>예시 · 평가 기준 설정</button></div>
              <div className={styles.weightSummary}>{WEIGHT_FIELDS.map((field) => <div key={field.key}><span>{field.label}</span><strong>{form[field.key] || "—"}%</strong></div>)}</div>
            </div>
            <ScoreRow label="출석" scoreKey="attendanceScore" maxKey="attendanceMax" form={form} onChange={changeForm} />
            <ScoreRow label="과제" scoreKey="assignmentScore" maxKey="assignmentMax" form={form} onChange={changeForm} />
            <div className={styles.inputRow}><label htmlFor="mid-rank">중간고사 등수 {!exclusion && <span className={styles.required}>필수</span>}</label><div className={styles.fraction}><input id="mid-rank" type="number" min="1" max={Number(form.enrollment) || undefined} step="1" required={!exclusion} value={form.midRank} aria-invalid={!exclusion && !validation.ok && Boolean(validation.errors.midRank)} onChange={(event) => changeForm("midRank", event.target.value)} /><span>/</span><input type="number" min="1" max="10000" step="1" value={form.enrollment} aria-label="수강 인원" onChange={(event) => changeForm("enrollment", event.target.value)} /></div></div>
            {exclusion && <p className={styles.exclusionNote} role="status">{exclusion}</p>}
            {!exclusion && !validation.ok && <ul className={styles.errors} aria-live="polite">{Object.entries(validation.errors).map(([key, message]) => <li key={key}>{message}</li>)}</ul>}
            {!exclusion && validation.ok && validation.defaults.length > 0 && <p className={styles.hint}>기본값 적용: {validation.defaults.join(", ")}</p>}
          </section>
          <div className={styles.column}>
            <section className={styles.card} aria-live="polite">
              <div className={styles.goalTabs} role="group" aria-label="목표 등급">{GOALS.map((grade) => <button key={grade} type="button" aria-pressed={goal === grade} onClick={() => setGoals((stored) => ({ ...stored, [courseId]: grade }))}>{grade}</button>)}</div>
              <p className={styles.resultTitle}>{selectedCourse.name} {goal}에 필요한 기말고사 등수</p>
              <p className={styles.resultNumber}>{exclusion ? "상대평가 적용 제외" : result ? rankText(result) : "입력값을 확인해주세요"}</p>
              <p className={styles.resultDescription}>{exclusion ?? (result && input ? result.status === "rank" ? `${input.enrollment}명 중 상위 ${Number(result.percentage.toFixed(1))}%` : result.status === "any" ? "입력한 가정에서는 기말 등수 제약이 없어요." : result.status === "excluded" ? result.reason : "입력한 가정에서는 기말 1등이어도 목표에 미달해요." : "유효한 값을 입력하면 추정 결과가 표시돼요.")}</p>
              <p className={styles.referenceNote}>가정 기반 참고 추정 · 실제 학점과 다를 수 있어요.</p>
            </section>
            <section className={styles.card}>
              <div className={styles.cardHeading}><h2>내 위치<HelpButton label="내 위치 설명 보기" onClick={() => setHelp("position")} /></h2></div>
              {input && result ? <div className={styles.positionChart}>
                <div className={styles.zones}>{getRelativeSegments(input.groupRatios, input.cutoffs).map((zone, index) => <div key={zone.label} className={styles[`zone${index}`]} style={{ width: `${zone.width}%` }}>{zone.width >= 8 ? zone.label : ""}</div>)}</div>
                {/* 테두리는 1등부터 추정 기말 목표 등수까지의 범위를 뜻한다. */}
                {(result.status === "rank" || result.status === "any") && <><span className={styles.goalFrame} style={{ width: `calc(${result.percentage}% + 4px)` }} /><span className={styles.goalPin} style={{ left: `clamp(34px, ${result.percentage}%, calc(100% - 34px))` }}>기말 목표</span></>}
                <span className={styles.midPin} style={{ left: `clamp(28px, ${input.midRank / input.enrollment * 100}%, calc(100% - 28px))` }}>▲ 중간 {input.midRank}등</span>
              </div> : <p className={styles.hint}>{exclusion ? "이 강좌에는 학교 상대평가 분포를 적용하지 않아요." : "입력값을 확인하면 위치를 표시해요."}</p>}
            </section>
            <section className={styles.card}>
              <div className={styles.cardHeading}><h2>학점별 필요 등수<HelpButton label="학점별 필요 등수 설명 보기" onClick={() => setHelp("ranks")} /></h2></div>
              <table className={styles.rankTable}><caption className={styles.srOnly}>목표 등급별 기말 등수 참고 추정</caption><thead className={styles.srOnly}><tr><th scope="col">등급</th><th scope="col">필요 등수</th></tr></thead><tbody>{GOALS.map((grade) => {
                const estimate = input ? estimateFinalRank(input, grade) : null;
                return <tr key={grade} className={grade === goal ? styles.selectedRank : undefined}><th scope="row">{grade}</th><td>{exclusion ? "적용 제외" : estimate ? rankText(estimate) : "—"}</td></tr>;
              })}</tbody></table>
            </section>
          </div>
        </div>)}
      </section>
      {data.source === "sample" && <p className={styles.demoNote}>예시 성적·강의 데이터로 체험 중</p>}
    </div>
    {help && <GradesHelpDialog kind={help} cutoffs={cutoffs} onClose={() => setHelp(null)} />}
    {showSettings && form && <PredictorSettings form={form} onChange={changeForm} onReset={() => setForms((stored) => ({ ...stored, [courseId]: defaults[courseId] }))} onClose={() => setShowSettings(false)} />}
  </main>;
}
