"use client";

import { useSyncExternalStore } from "react";
import type { StudentProfile } from "./profile-model";

export type GraduationDates = { admission: string; graduation: string; graduationDateIsEstimate?: boolean };

// 사용자가 제공한 화면의 일정이다. 추후 사용자 일정 API의 값으로 교체한다.
// 홈·도움말·해 위치·D-day는 이 일정 한 곳을 함께 읽는다.
export const GRADUATION_DATES: GraduationDates = {
  admission: "2024-03-04",
  graduation: "2028-02-25",
};

const DAY = 24 * 60 * 60 * 1000;

// 시간을 제외한 날짜를 UTC의 일 단위 숫자로 변환한다.
// 이 방식이면 브라우저 시간대나 일광절약시간으로 하루 차이가 나지 않는다.
function dayNumber(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError("날짜는 YYYY-MM-DD 형식이어야 해요.");
  const [, year, month, day] = match.map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError("존재하지 않는 날짜예요.");
  }
  return timestamp / DAY;
}

// 테스트에서도 같은 함수를 사용한다. new Date()는 이 계산 함수 내부에서 호출하지 않는다.
export function calculateGraduationProgress(dates: GraduationDates, today: string) {
  const start = dayNumber(dates.admission);
  const end = dayNumber(dates.graduation);
  if (end <= start) throw new RangeError("졸업 예정일은 입학일보다 뒤여야 해요.");
  const current = dayNumber(today);
  const totalDays = end - start;
  const elapsedDays = Math.min(totalDays, Math.max(0, current - start));
  return {
    totalDays,
    elapsedDays,
    percentage: elapsedDays / totalDays * 100,
    remainingDays: end - current,
  };
}

export function formatGraduationDate(value: string) {
  return value.replaceAll("-", ".");
}

// 한국 날짜를 기준으로 하루 단위 진행률을 표시한다.
function getToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function subscribeToToday(onChange: () => void) {
  // 화면을 계속 열어두거나 다른 탭에서 돌아왔을 때 날짜를 갱신한다.
  const timer = window.setInterval(onChange, 60_000);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

const getServerToday = (): string | null => null;

export function useGraduationProgress(dates: GraduationDates) {
  // 서버와 최초 클라이언트 렌더에서는 같은 빈 상태를 사용해 hydration 오류를 피한다.
  const today = useSyncExternalStore<string | null>(subscribeToToday, getToday, getServerToday);
  return today ? calculateGraduationProgress(dates, today) : null;
}

// 연·월은 사용자 선택값을 사용한다. 입학일은 기존 3/4 예시를 유지한다.
// 졸업일의 '일'은 공식 일정 API 연결 전까지 25일을 임시 사용하며 화면에 안내한다.
// 매년 2/25 또는 8/25가 학교의 공식 졸업일이라는 뜻은 아니다.
export function getProfileGraduationDates(profile: Pick<StudentProfile, "admissionYear" | "graduationYear" | "graduationMonth">): GraduationDates {
  return {
    admission: `${profile.admissionYear}${GRADUATION_DATES.admission.slice(4)}`,
    graduation: `${profile.graduationYear}-${String(profile.graduationMonth).padStart(2, "0")}-25`,
    graduationDateIsEstimate: true,
  };
}
