"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { pretendard } from "../fonts/pretendard";
import { WeatherIcon } from "../weather-icon";
import styles from "./page.module.css";

const DURATION = 6400;
const STARS = [[14, 12], [33, 30], [67, 10], [86, 34], [48, 22], [24, 62], [74, 56]];

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const reasons: Record<string, string> = {
  cancelled: "카카오 로그인이 취소되었습니다.",
  provider_error: "카카오 로그인에 실패했습니다. 다시 시도해 주세요.",
  session: "로그인이 필요합니다.",
};

function LoginNotice() {
  const reason = useSearchParams().get("reason");
  return reason && Object.hasOwn(reasons, reason) ? <p role="status">{reasons[reason]}</p> : null;
}

export default function LoginPage() {
  const [t, setT] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let start = 0;
    let frame = 0;
    const step = (now: number) => {
      if (reduced) {
        setT(100);
        return;
      }
      start ||= now + 500;
      const k = clamp((now - start) / DURATION);
      setT(50 * (1 - Math.cos(Math.PI * k)));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  const u = t / 100;
  return (
    <section className={`${pretendard.variable} ${styles.splash}`}>
      <div className={styles.stars} aria-hidden="true">
        {STARS.map(([left, top]) => <i key={`${left}-${top}`} style={{ left: `${left}%`, top: `${top}%` }} />)}
      </div>
      <header className={styles.head}>
        <h1>
          <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 17a5 5 0 0 1 10 0Z" fill="#FFC83D" />
            <path d="M12 7.5v2M17.3 11.7l1.4-1.4M6.7 11.7l-1.4-1.4" stroke="#FFC83D" strokeWidth="2" strokeLinecap="round" />
            <path d="M2.5 17h19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          시평
        </h1>
        <div>서울시립대학교</div>
      </header>
      <div className={styles.inner}>
        <div className={styles.show} aria-hidden="true">
          <div className={styles.arc}>
            <svg viewBox="0 0 300 86" preserveAspectRatio="none">
              <clipPath id="spClip"><rect x="0" y="-10" width={3 * t} height="100" /></clipPath>
              <path className={styles.a0} d="M0 80Q150-40 300 80" />
              <path className={styles.a1} d="M0 80Q150-40 300 80" clipPath="url(#spClip)" />
              <path className={styles.hz} d="M0 80H300M75 76v8M150 76v8M225 76v8" />
            </svg>
            <span className={styles.sun} style={{ left: `${t}%`, top: `${((80 - 240 * u * (1 - u)) / 86) * 100}%` }}>
              <WeatherIcon sky="sun" />
            </span>
          </div>
          <div className={styles.ends}><span>입학</span><span>졸업</span></div>
        </div>
        <a href="/api/auth/login/kakao?returnTo=/" className={`${styles.kakao} ${styles.tap}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.77l-.95 3.48c-.08.3.26.54.52.37l4.14-2.75c.53.07 1.07.11 1.63.11 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
          </svg>
          카카오 로그인
        </a>
        <Suspense fallback={null}><LoginNotice /></Suspense>
      </div>
    </section>
  );
}
