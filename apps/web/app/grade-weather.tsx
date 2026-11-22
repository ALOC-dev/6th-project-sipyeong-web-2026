import styles from "./grade-weather.module.css";
import { getLastStudySemester } from "./profile-model";
import type { GraduationMonth } from "./profile-model";
import { summarize } from "./grades/grade-utils";
import type { Semester } from "./grades/grade-utils";

export type WeatherType = "sunny" | "partly" | "cloudy" | "rain" | "pending";

// 도움말과 실제 아이콘 판정이 같은 표를 읽는다. 높은 기준부터 비교한다.
export const WEATHER_BANDS = [
  { type: "sunny", minimum: 4.0, label: "4.0 이상" },
  { type: "partly", minimum: 3.7, label: "3.7 이상" },
  { type: "cloudy", minimum: 3.5, label: "3.5 이상" },
  { type: "rain", minimum: -Infinity, label: "3.5 미만" },
] as const;

export function getWeatherType(gpa: number | null): WeatherType {
  if (gpa === null || !Number.isFinite(gpa)) return "pending";
  return WEATHER_BANDS.find((band) => gpa >= band.minimum)!.type;
}

// 도움말·홈·학점 그래프가 HTML 원본의 같은 도형을 사용한다.
export function WeatherIcon({ type, tone = "card" }: { type: WeatherType; tone?: "hero" | "card" }) {
  const labels: Record<WeatherType, string> = { sunny: "맑음", partly: "구름 조금", cloudy: "흐림", rain: "비", pending: "성적 미확정" };
  const sun = <><circle cx="12" cy="12" r="4.6" fill="#FFC83D" /><path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M5.4 18.6l1.4-1.4M17.2 6.8l1.4-1.4" stroke="#FFC83D" strokeWidth="2" strokeLinecap="round" /></>;
  const moon = <path fill="#F1E7C8" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />;
  const cloud = "M7 19h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 19z";
  return <svg className={`${styles.icon} ${tone === "hero" ? styles.hero : styles.card}`} viewBox="0 0 24 24" fill="none" role="img" aria-label={labels[type]}>
    {(type === "sunny" || type === "partly") && <g transform={type === "partly" ? "translate(-1.5 -2.5) scale(.78)" : undefined}><g className={styles.day}>{sun}</g><g className={styles.night}>{moon}</g></g>}
    {(type === "partly" || type === "cloudy" || type === "rain") && <path d={cloud} transform={type === "partly" ? "translate(1.5 1)" : type === "rain" ? "translate(0 -3.5)" : "translate(0 -1)"} fill="var(--weather-cloud)" />}
    {type === "rain" && <path d="M9 18.5l-1 3M13 18.5l-1 3M17 18.5l-1 3" stroke="#8CC8FF" strokeWidth="2" strokeLinecap="round" />}
    {type === "pending" && <g stroke="currentColor" opacity=".6"><circle cx="12" cy="12" r="8" strokeDasharray="2 3" /><path d="M9 12h6" /></g>}
  </svg>;
}

export function GradeWeather({ gpa, tone }: { gpa: number | null; tone?: "hero" | "card" }) {
  return <WeatherIcon type={getWeatherType(gpa)} tone={tone} />;
}

export function buildSemesterWeather(input: {
  history: Semester[]; currentSemester: string; admissionYear: number; graduationYear: number; graduationMonth: GraduationMonth;
  currentTarget: number | null; remainingSemesterAverage: number | null;
}) {
  const currentMatch = /^(\d{4})-([12])$/.exec(input.currentSemester);
  if (!currentMatch) throw new RangeError("현재 학기는 YYYY-1 또는 YYYY-2 형식이어야 해요.");
  const start = input.admissionYear * 2;
  const current = Number(currentMatch[1]) * 2 + Number(currentMatch[2]) - 1;
  // 8월 졸업이면 해당 연도 1학기까지 포함한다.
  const [lastYear, lastTerm] = getLastStudySemester(input.graduationYear, input.graduationMonth).split("-").map(Number);
  const end = Math.max(current, lastYear * 2 + lastTerm - 1);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => {
    const order = start + index;
    const id = `${Math.floor(order / 2)}-${order % 2 + 1}`;
    const record = input.history.find((semester) => semester.id === id);
    const isCurrent = order === current;
    return {
      id,
      label: isCurrent ? "지금" : `${Math.floor(index / 2) + 1}-${index % 2 + 1}`,
      current: isCurrent,
      gpa: order < current ? (record ? summarize(record.courses).gpa : null)
        : isCurrent ? input.currentTarget : input.remainingSemesterAverage,
      basis: order < current ? "취득 평점" : isCurrent ? "플래너 목표 평점" : "평점 계획의 남은 학기 평균",
    };
  });
}
