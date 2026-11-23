"use client";

import type { RefObject } from "react";
import { formatGraduationDate } from "./graduation-progress";
import type { GraduationDates } from "./graduation-progress";
import styles from "./help-dialog.module.css";
import { DialogClose } from "./help-button";

export function GraduationProgressDialog({ dialogRef, dates }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  dates: GraduationDates | null;
}) {
  return (
    // native dialog가 Esc 종료, 배경 조작 차단, 팝업 안 포커스 이동을 지원한다.
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="graduation-progress-title">
      <span className={styles.handle} aria-hidden="true" />
      <DialogClose label="졸업 진행률 안내 닫기" onClick={() => dialogRef.current?.close()} />
      <h2 id="graduation-progress-title">졸업 진행률</h2>
      <dl className={styles.rows}>
        <div><dt>입학 학년도 시작</dt><dd>{dates ? formatGraduationDate(dates.admission) : "—"}</dd></div>
        <div><dt>졸업 예정</dt><dd>{dates ? formatGraduationDate(dates.graduation) : "미설정"}</dd></div>
        <div><dt>진행률</dt><dd>지난 기간 ÷ 전체 기간 × 100</dd></div>
        <div><dt>해 위치</dt><dd>진행률</dd></div>
      </dl>
      {!dates && <p className={styles.dateNote}>학적 정보에 현재 학년·학기를 입력하면 진행률을 볼 수 있어요.</p>}
      {dates?.graduationDateIsEstimate && <p className={styles.dateNote}>
        졸업 예정일은 계산한 연·월의 25일을 기준으로 표시해요. 실제 일자는 학교 학사일정에 따라 달라질 수 있어요.
      </p>}
    </dialog>
  );
}
