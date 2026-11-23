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

// 날짜를 한국 시각 자정으로 해석해 브라우저 시간대와 무관하게 계산한다.
function koreaMidnight(value: string) { return dayNumber(value) * DAY - 9 * 60 * 60 * 1000; }

export function calculatePeriodProgress(startDate: string, endDate: string, now: number) {
  const start = koreaMidnight(startDate), end = koreaMidnight(endDate);
  if (end <= start || !Number.isFinite(now)) throw new RangeError("진행률 계산 일정을 확인해주세요.");
  return Math.min(100, Math.max(0, (now - start) / (end - start) * 100));
}

export function calculateRealtimeGraduationProgress(dates: GraduationDates, now: number) {
  const start = koreaMidnight(dates.admission), end = koreaMidnight(dates.graduation);
  const percentage = calculatePeriodProgress(dates.admission, dates.graduation, now);
  return {
    timestamp: now, percentage, totalDays: (end - start) / DAY,
    elapsedDays: Math.min(end - start, Math.max(0, now - start)) / DAY,
    remainingDays: Math.ceil((end - now) / DAY) || 0,
  };
}

// getSnapshot에서 Date.now()를 직접 반환하면 렌더 때마다 값이 달라진다.
// 저장된 시각을 반환하고, 100ms마다 갱신한 뒤 구독자에게 알린다.
let clockSnapshot: number | null = null;
const listeners = new Set<() => void>();
let clockTimer: number | undefined;
function refreshClock() {
  if (document.visibilityState === "hidden") return;
  clockSnapshot = Date.now();
  listeners.forEach((listener) => listener());
}
function subscribeClock(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refreshClock();
    clockTimer = window.setInterval(refreshClock, 100);
    window.addEventListener("focus", refreshClock);
    document.addEventListener("visibilitychange", refreshClock);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(clockTimer);
      window.removeEventListener("focus", refreshClock);
      document.removeEventListener("visibilitychange", refreshClock);
    }
  };
}
const getClockSnapshot = () => clockSnapshot;
const getServerClock = (): number | null => null;
export function useGraduationProgress(dates: GraduationDates | null) {
  // 서버와 최초 렌더는 같은 빈 값으로 시작해 hydration 오류를 피한다.
  const now = useAcademicClock();
  return now === null || dates === null ? null : calculateRealtimeGraduationProgress(dates, now);
}

export function useAcademicClock() {
  return useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClock);
}

export function nextCalendarDate(value: string) {
  return new Date((dayNumber(value) + 1) * DAY).toISOString().slice(0, 10);
}

// 연·월은 사용자 선택값을 사용한다. 입학일은 기존 3/4 예시를 유지한다.
// 졸업일의 '일'은 공식 일정 API 연결 전까지 25일을 임시 사용하며 화면에 안내한다.
// 매년 2/25 또는 8/25가 학교의 공식 졸업일이라는 뜻은 아니다.
export function getProfileGraduationDates(profile: Pick<StudentProfile, "admissionYear" | "graduationYear" | "graduationMonth">): GraduationDates {
  return {
    admission: `${profile.admissionYear}-03-01`,
    graduation: `${profile.graduationYear}-${String(profile.graduationMonth).padStart(2, "0")}-25`,
    graduationDateIsEstimate: true,
  };
}
