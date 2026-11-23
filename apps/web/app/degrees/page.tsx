import styles from "./page.module.css";

// 추후 구현해도 /degrees 경로와 메뉴 연결을 그대로 유지할 수 있다.
export default function DegreesPage() {
  return <main className={styles.page}>
    <header><p>나의 학업 설계</p><h1>마이크로디그리</h1></header>
    <section className={styles.card}>
      <h2>준비 중입니다.</h2>
      <p>마이크로디그리 기능을 준비하고 있어요.</p>
    </section>
  </main>;
}
