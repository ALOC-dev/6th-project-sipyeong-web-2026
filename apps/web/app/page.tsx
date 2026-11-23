"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AcademicNav } from "./academic-nav";
import { loadAccount } from "./academic-account";
import { api, displayNumber, listPages, type GradeSummary, type SemesterGrade } from "./api-client";
import { useApi } from "./use-api";
import styles from "./page.module.css";

type WeatherType =
  | "rainbow"
  | "sunny"
  | "partly"
  | "cloudy"
  | "rain"
  | "pending";

/* 평점을 날씨로 변환 */
function getWeatherType(gpa: number | null): WeatherType {
  if (gpa === null) return "pending";
  if (gpa >= 4.5) return "rainbow";
  if (gpa >= 4.0) return "sunny";
  if (gpa >= 3.5) return "partly";
  if (gpa >= 3.0) return "cloudy";
  return "rain";
}

/* 날씨 아이콘 */
function WeatherIcon({ type }: { type: WeatherType }) {
  const labels: Record<WeatherType, string> = {
    rainbow: "무지개",
    sunny: "맑음",
    partly: "구름 조금",
    cloudy: "흐림",
    rain: "비",
    pending: "성적 미확정",
  };

  const showSun = type === "sunny" || type === "partly";
  const showCloud =
    type === "partly" || type === "cloudy" || type === "rain";

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={labels[type]}
    >
      {type === "rainbow" && (
        <g strokeWidth="3" strokeLinecap="round">
          <path d="M3 25a13 13 0 0 1 26 0" stroke="#FF8795" />
          <path d="M7 25a9 9 0 0 1 18 0" stroke="#FFD15C" />
          <path d="M11 25a5 5 0 0 1 10 0" stroke="#86E0CA" />
        </g>
      )}

      {showSun && (
        <g
          stroke="#FFD15C"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="15" cy="13" r="5" fill="#FFD15C" />
          <path d="M15 2v3M15 21v3M4 13h3M23 13h3" />
          <path d="m7 5 2 2m12 12 2 2M7 21l2-2M21 7l2-2" />
        </g>
      )}

      {showCloud && (
        <g
          transform={
            type === "rain" ? "translate(0 -4)" : undefined
          }
        >
          <path
            d="M8 27a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 1 1 3 12H8Z"
            fill={type === "rain" ? "#C5D5E8" : "#FFFFFF"}
          />
        </g>
      )}

      {type === "rain" && (
        <g
          stroke="#BDE7FF"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="m10 26-1 3" />
          <path d="m17 26-1 3" />
          <path d="m24 26-1 3" />
        </g>
      )}

      {type === "pending" && (
        <g stroke="currentColor" strokeWidth="1.5">
          <circle
            cx="16"
            cy="16"
            r="10"
            strokeDasharray="3 3"
            opacity=".5"
          />
          <path d="M12 16h8" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

/* 메뉴 아이콘 */

async function loadHome(signal: AbortSignal) {
  const account = await loadAccount(signal);
  if (!account.me.profileCompleted) return { account };
  const [summary, semesters] = await Promise.all([
    api<GradeSummary>("grades/summary", { signal }),
    listPages<SemesterGrade>("grades/semesters", signal),
  ]);
  return { account, summary: summary.data, semesters };
}

export default function Home() {
  const router = useRouter();
  const { data, error, reload } = useApi(loadHome);
  const incomplete = data?.account.me.profileCompleted === false;

  useEffect(() => {
    if (incomplete) router.replace("/start");
  }, [incomplete, router]);

  if (!data?.summary) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>시평</h1>
          {error ? <><p role="alert">{error}</p><button type="button" onClick={reload}>다시 시도</button></>
            : <p role="status">학업 정보를 불러오는 중…</p>}
        </section>
      </main>
    );
  }

  const { account, summary, semesters = [] } = data;
  const profile = account.me.profile;
  const department = account.departments.find((item) => item.departmentId === profile?.departmentId);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.student}>{department?.name}{profile && ` · ${profile.admissionYear}학번`}</p>
        <h1 className={styles.title}>학업 현황</h1>
        <section className={styles.semesterSection}>
          <div className={styles.sectionHeading}><h2>학기별 평점</h2></div>
          {semesters.length === 0 ? <p>등록된 성적이 없습니다.</p> : (
            <div className={styles.semesterGrid}>
              {semesters.map(({ semester, gpa }) => (
                <div key={semester.semesterId} className={styles.semester}>
                  <span>{semester.name}</span>
                  <WeatherIcon type={getWeatherType(gpa)} />
                  <strong>{displayNumber(gpa, 2)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </header>
      <div className={styles.content}>
        <section className={`${styles.card} ${styles.summaryCard}`}>
          <div className={styles.cardHeading}><h2>성적 요약</h2><Link href="/grades">학점 상세 ›</Link></div>
          <dl className={styles.summaryList}>
            {[
              ["취득학점", displayNumber(summary.earnedCredits, undefined, "학점")],
              ["수강 중인 학점", displayNumber(summary.enrolledCredits, undefined, "학점")],
              ["누적 평균평점", summary.gpa === null ? "—" : `${displayNumber(summary.gpa, 2)} / ${summary.gradeScale}`],
            ].map(([label, value]) => (
              <div className={styles.summaryRow} key={label}><dt>{label}</dt><dd><strong>{value}</strong></dd></div>
            ))}
          </dl>
          {summary.warnings.filter((warning) => warning.code !== "REQUIREMENT_CREDITS_UNAVAILABLE").map((warning) => (
            <p className={styles.warning} key={warning.code}>{warning.message}</p>
          ))}
        </section>
        <section className={styles.card}>
          <h2>성적 파일</h2>
          <Link href="/my">내 정보에서 파일 업데이트 ›</Link>
        </section>
      </div>
      <AcademicNav current="/" />
    </main>
  );
}
