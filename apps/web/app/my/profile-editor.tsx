"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ADMISSION_YEARS,
  getCurriculumRequirements,
  getGraduationOptions,
  getEngineeringRequiredCredits,
  SUPPORTED_DEPARTMENT,
  validateProfile,
} from "../profile-model";
import type { GraduationMonth, StudentProfile } from "../profile-model";
import styles from "./profile-editor.module.css";

export function ProfileEditor({ profile, onSave, onClose }: {
  profile: StudentProfile;
  onSave: (next: StudentProfile) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 적용 전까지 편집 복사본만 변경한다. 뒤로 가기·Esc는 변경을 취소한다.
  const [draft, setDraft] = useState<StudentProfile>(() => ({ ...profile }));
  const [error, setError] = useState("");
  const criteria = getCurriculumRequirements(draft.admissionYear);
  const engineeringCredits = getEngineeringRequiredCredits(draft);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function close() { dialogRef.current?.close(); }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateProfile(draft);
    if (message) { setError(message); return; }
    try { onSave(draft); close(); }
    catch { setError("변경 내용을 반영하지 못했어요. 다시 시도해주세요."); }
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="profile-editor-title" onClose={onClose}>
      {/* 별도 단계 없이 기본 정보를 수정한다. 뒤로 가기는 왼쪽에 고정한다. */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button type="button" className={styles.backButton} onClick={close}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
            <span>내 정보</span>
          </button>
          <h2 id="profile-editor-title">학적 정보 변경</h2>
          <svg className={styles.sun} viewBox="0 0 32 32" fill="none" stroke="#FFD15C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="16" cy="16" r="6" fill="#FFD15C" />
            <path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M6 26l3-3M23 9l3-3" />
          </svg>
        </div>
      </header>

      <form className={styles.form} onSubmit={save}>
        <section className={styles.card} aria-label="학적 정보 입력">
          <div className={styles.field}>
            <label htmlFor="profile-department">학과</label>
            <select id="profile-department" defaultValue={draft.department}>
              <option value={SUPPORTED_DEPARTMENT}>{SUPPORTED_DEPARTMENT}</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="profile-admission-year">입학연도</label>
            <select id="profile-admission-year" value={draft.admissionYear} onChange={(event) => {
              const admissionYear = Number(event.currentTarget.value);
              // 입학연도를 바꿨을 때 졸업연도가 선택 범위를 벗어나지 않도록 맞춘다.
              setDraft((previous) => ({ ...previous, admissionYear,
                graduationYear: Math.max(previous.graduationYear, admissionYear + 3),
              }));
            }}>
              {ADMISSION_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="profile-graduation-period">졸업 예정 시기</label>
            <select id="profile-graduation-period" value={`${draft.graduationYear}-${String(draft.graduationMonth).padStart(2, "0")}`} onChange={(event) => {
              const [graduationYear, month] = event.currentTarget.value.split("-").map(Number);
              setDraft((previous) => ({ ...previous, graduationYear, graduationMonth: month as GraduationMonth }));
            }}>
              {getGraduationOptions(draft.admissionYear, draft.graduationYear).map((option) =>
                <option key={option.value} value={option.value}>{option.label}</option>,
              )}
            </select>
          </div>
          <div className={styles.switchRow}>
            <label htmlFor="profile-engineering">공학인증 이수 대상</label>
            <span className={styles.switch}>
              <input id="profile-engineering" type="checkbox" role="switch" checked={draft.engineeringCertification} onChange={(event) => {
                const engineeringCertification = event.currentTarget.checked;
                setDraft((previous) => ({ ...previous, engineeringCertification }));
              }} />
              <span className={styles.switchTrack} aria-hidden="true" />
            </span>
          </div>
        </section>

        <div className={styles.side}>
          {/* 별도 프로필 미리보기 대신 요청한 졸업요건 기준표를 표시한다. */}
          <section className={styles.card} aria-labelledby="profile-criteria-title">
            <h3 id="profile-criteria-title">적용되는 기준</h3>
            <p className={styles.curriculum}>{draft.admissionYear}학년도 교육과정</p>
            <dl className={styles.requirements} aria-live="polite">
              <div><dt>졸업 최저 이수학점</dt><dd>{criteria?.total ?? "—"}</dd></div>
              <div><dt>전공필수</dt><dd>{criteria?.majorRequired ?? "—"}</dd></div>
              <div><dt>전공선택</dt><dd>{criteria?.majorElective ?? "—"}</dd></div>
              <div><dt>교양</dt><dd>{criteria?.general ?? "—"}</dd></div>
              <div><dt>공학소양</dt><dd>{engineeringCredits}</dd></div>
            </dl>
            {!criteria && <p className={styles.notice}>해당 입학연도의 기준 정보는 준비 중이에요.</p>}
          </section>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.saveButton}>변경 적용</button>
        </div>
      </form>
    </dialog>
  );
}
