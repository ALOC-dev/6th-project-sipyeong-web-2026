"use client";

import { useEffect, useRef } from "react";
import { DialogClose } from "./help-button";
import styles from "./help-dialog.module.css";

const content = {
  summary: { title: "요약", note: "업로드한 성적표로 취득 학점과 평점을 집계하고, 이번 학기 수강신청확인서로 수강 과목 수와 학점을 표시해요." },
  requirements: { title: "남은 졸업요건", note: "진한 막대는 취득 학점, 옅은 막대는 이번 학기 수강분을 포함한 예상 학점이에요. 봉사·어학과 과목별 요건은 졸업요건 탭에서 확인해요." },
  gpa: { title: "누적 평점", note: "이번 학기 수강 학점에 플래너 목표 평점을 적용해 예상 누적 평점을 계산해요. 재수강에 따른 기존 성적 대체와 수강 과목의 P/F 여부는 예상치에 반영되지 않아요." },
};

export type HomeHelpKind = keyof typeof content;

export function HomeHelpDialog({ kind, onClose }: { kind: HomeHelpKind; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="home-help-title" onClose={onClose}>
    <span className={styles.handle} aria-hidden="true" />
    <DialogClose label="도움말 닫기" onClick={() => dialogRef.current?.close()} />
    <h2 id="home-help-title">{content[kind].title}</h2>
    <p className={styles.note}>{content[kind].note}</p>
  </dialog>;
}
