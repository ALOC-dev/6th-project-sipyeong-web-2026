import styles from "./help-button.module.css";

// 원본 qm: 기본 18px, 졸업 현황 제목 옆 큰 버튼만 30px이다.
export function HelpButton({ label, onClick, large = false, tone = "card" }: {
  label: string; onClick: () => void; large?: boolean; tone?: "card" | "hero";
}) {
  return <button type="button" className={`${styles.help} ${large ? styles.large : ""} ${tone === "hero" ? styles.hero : ""}`} aria-label={label} aria-haspopup="dialog" onClick={onClick}>?</button>;
}

// 폰트에 따라 모양이 달라지는 × 문자 대신 HTML과 같은 X 도형을 쓴다.
export function DialogClose({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className={styles.close} aria-label={label} onClick={onClick}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" /></svg></button>;
}
