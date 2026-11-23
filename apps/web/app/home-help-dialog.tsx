"use client";

import { useEffect, useRef } from "react";
import { useGradePlan } from "./grade-plan-provider";
import { DialogClose } from "./help-button";
import styles from "./help-dialog.module.css";

export type HomeHelpKind = "summary" | "requirements" | "recommendations" | "gpa";

// 카드의 ?도 툴팁 글자 대신 동일한 도움말 창을 연다.
export function HomeHelpDialog({ kind, onClose }: { kind: HomeHelpKind; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { previous, previousMajor, currentCredits, plan, forecast } = useGradePlan();
  const fmt = (value: number | null) => value === null ? "—" : value.toFixed(2);
  const content = {
    summary: { title: "요약", rows: [["전체 평점", fmt(previous.gpa)], ["전공 평점", fmt(previousMajor.gpa)], ["평점 만점", "4.5"], ["취득 학점", `${previous.earnedCredits}학점`], ["평점 제외", "재수강 이전 성적, P/F 과목"]], note: "평점과 학점은 홈과 학점 탭에서 같은 성적 목록으로 계산해요." },
    requirements: { title: "남은 졸업요건", rows: [["진한 막대", "인정 학점"], ["옅은 막대", "이번 학기 수강 중"], ["숫자", "미이수 학점"]], note: "외국어 인증과 사회봉사는 별도 졸업요건이에요. 공학소양은 내 정보의 공학인증 대상 설정을 반영해요." },
    recommendations: { title: "추천 과목", rows: [["확인 항목", "미이수 전공필수, 선수과목, 권장 학년·학기, 개설 학기, 마이크로디그리 인정 과목"]], note: "현재 추천 목록은 예시 자료예요." },
    gpa: { title: "누적 평점", rows: [["현재", fmt(previous.gpa)], ["이번 학기", `${currentCredits}학점 · 제안 평점 ${plan.possible ? fmt(plan.summary.gpa) : "계산 불가"}`], ["학기 후", fmt(forecast)], ["계산", "(기존 평점 × 평점 반영 학점 + 이번 학기 평점 × 반영 학점) ÷ 전체 반영 학점"]], note: "P/F와 재수강 이전 성적은 평점 계산에서 제외해요." },
  }[kind];
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="home-help-title" onClose={onClose}>
    <span className={styles.handle} aria-hidden="true" />
    <DialogClose label="도움말 닫기" onClick={() => dialogRef.current?.close()} />
    <h2 id="home-help-title">{content.title}</h2>
    <dl className={styles.rows}>{content.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className={styles.note}>{content.note}</p>
  </dialog>;
}
