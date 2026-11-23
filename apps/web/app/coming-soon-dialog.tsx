"use client";

import { useEffect, useRef } from "react";
import styles from "./coming-soon-dialog.module.css";

export function ComingSoonDialog({ feature, onClose }: { feature: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="coming-soon-title" onClose={onClose}>
    <button type="button" className={styles.closeButton} aria-label="준비 중 안내 닫기" onClick={() => dialogRef.current?.close()}>×</button>
    <h2 id="coming-soon-title">준비 중입니다.</h2>
    <p>{feature} 기능을 준비하고 있어요.</p>
    <button type="button" className={styles.confirmButton} onClick={() => dialogRef.current?.close()}>확인</button>
  </dialog>;
}
