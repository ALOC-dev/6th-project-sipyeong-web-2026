"use client";

import { useEffect, useRef } from "react";
import { useGradePlan } from "../grade-plan-provider";
import { DialogClose } from "../help-button";
import { GOALS } from "./grade-utils";
import type { GoalGrade } from "./grade-utils";
import styles from "../help-dialog.module.css";

export type GradesHelpKind = "history" | "planner" | "courses" | "position" | "ranks";

export function GradesHelpDialog({ kind, cutoffs, onClose }: {
  kind: GradesHelpKind; cutoffs: Record<GoalGrade, number> | null; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { previous, target, plan, forecast, resetPlan } = useGradePlan();
  const fmt = (value: number | null) => value === null ? "—" : value.toFixed(2);
  const content = {
    history: { title: "학기별 기록", rows: [["평점", "과목 학점으로 가중평균한 취득 평점"], ["평점 제외", "P와 재수강 대체 전 성적"], ["이수학점", "P 포함, F와 대체 전 성적 제외"], ["날씨", "각 학기의 취득 평점 기준"]], note: "F는 평점 계산에는 0점으로 포함돼요. 평점이 없는 학기는 —로 표시해요." },
    planner: { title: "이번 학기 목표 평점", rows: [["목표", target.toFixed(2)], ["제안 평점", plan.possible ? fmt(plan.summary.gpa) : "고정 조건에서 달성 불가"], ["전공 예상", plan.possible ? fmt(plan.major.gpa) : "—"], ["교양·일반선택", plan.possible ? fmt(plan.general.gpa) : "—"], ["누적 평점", `${fmt(previous.gpa)} → ${fmt(forecast)}`]], note: "목표를 충족하는 조합 하나를 제안해요. 미고정 과목은 C0 이상에서 배분하고, 누적 평점은 제안 조합의 학점 가중평균을 반영해요." },
    courses: { title: "과목별 목표", rows: [["고정", "원하는 성적으로 고정하고 나머지 과목을 다시 계산"], ["미고정", "목표 평점을 충족하는 예시 성적 조합"], ["기말 등수", "과목별 입력값을 반영한 참고 추정"], ["예측기 이동", "파란 목표 성적·등수 버튼 선택"]], note: "기말 등수는 A+, A0, B+, B0 목표에 제공해요. 점수 분포에 따른 실제 학점을 보장하는 결과는 아니에요." },
    position: { title: "내 위치", rows: [["색상 영역", "설정한 등급 묶음 비율과 +/0 배분 가정"], ["▲ 중간", "입력한 중간고사 등수"], ["검정 테두리", "추정한 기말 목표 등수 이내의 범위"]], note: "중간과 기말 위치를 비교하는 참고 그림이며 확정 학점은 아니에요." },
    ranks: { title: "학점별 필요 등수", rows: [["필요 등수", "목표 학점에 필요한 기말 등수 참고 추정"]], note: "학교 규정은 A·B 등급 묶음의 비율을 정해요. +와 0의 세부 배분은 별도 가정이며, 아래 값은 현재 설정을 반영해요." },
  }[kind];
  useEffect(() => { if (ref.current && !ref.current.open) ref.current.showModal(); }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="grades-help-title" onClose={onClose}>
    <span className={styles.handle} aria-hidden="true" />
    <DialogClose label="학점 도움말 닫기" onClick={() => ref.current?.close()} />
    <h2 id="grades-help-title">{content.title}</h2>
    <dl className={styles.rows}>{content.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {kind === "ranks" && <><h3>학점 기준 · 현재 배분 가정</h3>{cutoffs ? <dl className={styles.rows}>{GOALS.map((grade) => <div key={grade}><dt>{grade}</dt><dd>상위 {Number(cutoffs[grade].toFixed(2))}% 이내</dd></div>)}</dl> : <p className={styles.note}>예측기 입력값을 확인하면 적용 비율을 표시해요.</p>}</>}
    <p className={styles.note}>{content.note}</p>
    {kind === "planner" && <button type="button" onClick={resetPlan} style={{ marginTop: 16, border: 0, padding: "8px 0", background: "none", color: "var(--accent)", font: "inherit", fontSize: 14, cursor: "pointer" }}>목표와 고정 성적 초기화</button>}
  </dialog>;
}
