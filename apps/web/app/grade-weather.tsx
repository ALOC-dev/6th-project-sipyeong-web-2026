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

export function WeatherIcon({ type, tone = "card" }: { type: WeatherType; tone?: "hero" | "card" }) {
  const hero = tone === "hero";
  const labels: Record<WeatherType, string> = { sunny: "맑음", partly: "구름 조금", cloudy: "흐림", rain: "비", pending: "성적 미확정" };
  return <svg viewBox="0 0 32 32" fill="none" role="img" aria-label={labels[type]}>
    {(type === "sunny" || type === "partly") && <g stroke="#FFD15C" strokeWidth="2" strokeLinecap="round">
      <circle cx="15" cy="13" r="5" fill="#FFD15C" />
      <path d="M15 2v3M15 21v3M4 13h3M23 13h3m-19-8 2 2m12 12 2 2M7 21l2-2M21 7l2-2" />
    </g>}
    {(type === "partly" || type === "cloudy" || type === "rain") && <path transform={type === "rain" ? "translate(0 -4)" : undefined}
      d="M8 27a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 1 1 3 12H8Z"
      fill={hero && type !== "rain" ? "#FFFFFF" : "#C4D0DE"} />}
    {type === "rain" && <path d="m10 26-1 3m8-3-1 3m8-3-1 3" stroke="#8CCEFF" strokeWidth="2" strokeLinecap="round" />}
    {type === "pending" && <g stroke={hero ? "currentColor" : "var(--muted)"} opacity=".6">
      <circle cx="16" cy="16" r="10" strokeDasharray="3 3" /><path d="M12 16h8" />
    </g>}
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
