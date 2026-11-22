"use client";

import { useEffect, useRef } from "react";
import { DialogClose } from "../help-button";
import { RELATIVE_POLICY } from "./relative-policy";
import type { PredictorForm } from "./grade-utils";
import sheet from "../help-dialog.module.css";
import styles from "./page.module.css";

export const WEIGHT_FIELDS = [{ key: "attendanceWeight", label: "출석" }, { key: "assignmentWeight", label: "과제" }, { key: "midtermWeight", label: "중간고사" }, { key: "finalWeight", label: "기말고사" }] as const;

// 상세 설정을 팝업에 모아 기본 예측기 화면을 사진의 점수 입력 구성으로 유지한다.
export function PredictorSettings({ form, onChange, onReset, onClose }: {
  form: PredictorForm; onChange: (key: keyof PredictorForm, value: string) => void; onReset: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (ref.current && !ref.current.open) ref.current.showModal(); }, []);
  return <dialog ref={ref} className={sheet.dialog} aria-labelledby="predictor-settings-title" onClose={onClose}>
    <span className={sheet.handle} aria-hidden="true" /><DialogClose label="평가 기준 설정 닫기" onClick={() => ref.current?.close()} />
    <h2 id="predictor-settings-title">평가 기준 설정</h2>
    <div className={styles.inputRow}><label htmlFor="course-type">강좌 유형</label><select id="course-type" value={form.courseType} onChange={(event) => onChange("courseType", event.target.value)}><option value="regular">학부 일반강좌</option><option value="teacher">교직과목</option><option value="graduate">대학원 강좌</option></select></div>
    <h3>강의 평가 비율 · 예시값 · 합계 100%</h3>
    <div className={styles.assumptionGrid}>{WEIGHT_FIELDS.map((field) => <label key={field.key}>{field.label}<input type="number" min="0" max="100" step="any" value={form[field.key]} onChange={(event) => onChange(field.key, event.target.value)} /></label>)}</div>
    <h3>학교 등급분포 기준</h3>
    <table className={styles.policyTable}><caption className={styles.srOnly}>학교 규정의 등급 묶음 비율과 적용값</caption><thead><tr><th scope="col">등급 묶음</th><th scope="col">학교 기준</th><th scope="col">적용값</th></tr></thead><tbody>{RELATIVE_POLICY.map((rule) => <tr key={rule.group}><th scope="row">{rule.label}</th><td>{rule.base}% ±5%p<small>{rule.min}~{rule.max}%</small></td><td>{form[rule.formKey]}%</td></tr>)}</tbody></table>
    <p className={styles.hint}>15명 이하 강좌·교직과목·대학원 강좌에는 이 상대평가 기준을 적용하지 않아요.</p>
    <h3>묶음 분포 수정 · 허용 범위 안에서 합계 100%</h3>
    <div className={styles.assumptionGrid}>{RELATIVE_POLICY.map((rule) => <label key={rule.group}>{rule.label} ({rule.min}~{rule.max}%)<input type="number" min={rule.min} max={rule.max} step="any" value={form[rule.formKey]} onChange={(event) => onChange(rule.formKey, event.target.value)} /></label>)}</div>
    <h3>+/0 세부 배분 · 시뮬레이션 가정</h3>
    <div className={styles.assumptionGrid}>{([{ key: "aPlusShare", label: "A등급 중 A+ 비중(%)" }, { key: "bPlusShare", label: "B등급 중 B+ 비중(%)" }] as const).map((field) => <label key={field.key}>{field.label}<input type="number" min="0" max="100" step="any" value={form[field.key]} onChange={(event) => onChange(field.key, event.target.value)} /></label>)}</div>
    <p className={styles.hint}>기본값 50%는 각 묶음을 +와 0에 반씩 나누는 가정이에요. 학교가 정한 세부 등급 비율을 뜻하지 않아요.</p>
    <details className={styles.formula}><summary>점수·등수 환산 가정 보기</summary><p>중간은 등수 ÷ 인원 × 100, 출석은 100 − 득점률, 과제는 (100 − 득점률) × 2를 5~95 범위로 바꾼 뒤 평가 비율로 합산해요. 실제 성적 분포로 검증된 모형은 아니에요.</p><p>출석·과제 점수를 비우면 각각 득점률 100%·80%를 사용해요. 강의계획서에 맞춰 반영 비율과 만점을 수정해주세요.</p></details>
    <div className={styles.settingsActions}><button type="button" className={styles.textButton} onClick={onReset}>예시 입력으로 초기화</button><button type="button" className={styles.applyButton} onClick={() => ref.current?.close()}>확인</button></div>
  </dialog>;
}
