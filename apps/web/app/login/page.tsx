"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

type Sky = "pending" | "cloudy" | "partly" | "sunny";

const DURATION = 6400;
const GPA = [3.52, 3.61, 3.7, 3.78, 3.85, 3.91, 3.96, 4.01];
const FEATURES = [
  { name: "졸업요건", from: 0, to: 94, done: "충족" },
  { name: "로드맵", from: 0, to: 100, done: "" },
  { name: "마이크로디그리", from: 40, to: 80, done: "신청 가능" },
];

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function featureSky(k: number): Sky {
  if (k >= 1) return "sunny";
  if (k >= 0.85) return "partly";
  return k > 0 ? "cloudy" : "pending";
}

function gpaSky(gpa: number | undefined): Sky {
  if (gpa === undefined) return "pending";
  if (gpa >= 4) return "sunny";
  return gpa >= 3.5 ? "partly" : "cloudy";
}

function Sun() {
  return (
    <>
      <g className={styles.day} stroke="#FFD15C" strokeWidth="2" strokeLinecap="round">
        <circle cx="15" cy="13" r="5" fill="#FFD15C" />
        <path d="M15 2v3M15 21v3M4 13h3M23 13h3m-16-8 2 2m12 12 2 2M7 21l2-2M21 7l2-2" />
      </g>
      <path className={styles.night} d="M24 17.5A10 10 0 1 1 13.5 6a8 8 0 0 0 10.5 11.5Z" fill="#F1E7C8" />
    </>
  );
}

function SkyIcon({ type }: { type: Sky }) {
  return (
    <svg key={type} className={styles.skyIcon} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {type === "sunny" && <Sun />}
      {type === "partly" && <g transform="translate(-2 -2) scale(.8)"><Sun /></g>}
      {(type === "partly" || type === "cloudy") && <path d="M8 27a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 1 1 3 12H8Z" fill="#FFFFFF" />}
      {type === "pending" && <path d="M8 27a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 1 1 3 12H8Z" stroke="#FFFFFF" strokeWidth="1.6" strokeOpacity=".8" />}
    </svg>
  );
}

function Mark() {
  return (
    <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17a5 5 0 0 1 10 0Z" fill="#FFD15C" />
      <path d="M12 7.5v2M17.3 11.7l1.4-1.4M6.7 11.7l-1.4-1.4" stroke="#FFD15C" strokeWidth="2" strokeLinecap="round" />
      <path d="M2.5 17h19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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

  const position = t / 100;
  const sunX = 12 + 336 * position;
  const sunY = 140 - 480 * position * (1 - position);
  const passed = Math.floor(t / 12.5);
  const gpa = GPA[passed - 1];
  const semester = Math.min(7, passed);

  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <h1><Mark />시평</h1>
        <p>서울시립대학교</p>
      </header>

      <div className={styles.show} aria-hidden="true">
        <p className={styles.percentage}>{t.toFixed(2)}<span>%</span></p>
        <p className={styles.gpa}><SkyIcon type={gpaSky(gpa)} />누적 평점{gpa ? ` ${gpa.toFixed(2)}` : ""}</p>

        <svg className={styles.curve} viewBox="0 0 360 150">
          <path d="M12 140H348M96 136v8M180 136v8M264 136v8" stroke="white" strokeOpacity=".35" />
          <path d="M12 140Q180 -100 348 140" stroke="white" strokeOpacity=".45" strokeWidth="2" fill="none" />
          <path d={`M12 140Q${12 + 168 * position} ${140 - 240 * position} ${sunX} ${sunY}`} stroke="white" strokeWidth="2" fill="none" />
          <svg x={sunX - 14} y={sunY - 14} width="28" height="28" viewBox="0 0 32 32" overflow="visible">
            <Sun />
          </svg>
        </svg>
        <div className={styles.ends}><span>입학</span><span>졸업</span></div>

        <ul className={styles.features}>
          {FEATURES.map((feature, index) => {
            const k = clamp((t - feature.from) / (feature.to - feature.from));
            const sky = featureSky(k);
            const roadmap = index === 1;
            return (
              <li key={feature.name} className={sky === "sunny" ? styles.done : undefined}>
                <SkyIcon type={sky} />
                <strong>{feature.name}</strong>
                <em className={roadmap ? styles.term : undefined}>
                  {roadmap ? `${(semester >> 1) + 1}-${(semester & 1) + 1}` : feature.done}
                </em>
                <span className={roadmap ? `${styles.bar} ${styles.terms}` : styles.bar}>
                  <i style={{ width: `${k * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <Link href="/start" className={styles.kakao}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.77l-.95 3.48c-.08.3.26.54.52.37l4.14-2.75c.53.07 1.07.11 1.63.11 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
        </svg>
        카카오 로그인
      </Link>
    </main>
  );
}
