"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

// 시스템 선택지를 없애고 서비스에서 허용하는 테마를 두 가지로 제한한다.
export type Theme = "light" | "dark";

const STORAGE_KEY = "sipyeong-theme";
const THEME_CHANGE_EVENT = "sipyeong-theme-change";

// 페이지 안의 useState 대신 공통 모듈에서 값을 관리한다.
// 따라서 홈과 내 정보가 같은 테마를 읽으며 페이지 이동 시에도 값이 유지된다.
let currentTheme: Theme = "light";
let initialized = false;

function normalizeTheme(value: string | null): Theme {
  // 예전에 저장한 system 등의 값도 라이트로 정리한다.
  return value === "dark" ? "dark" : "light";
}

function subscribe(onStoreChange: () => void) {
  // subscribe는 브라우저에서만 실행된다. 서버 렌더링 중에는 저장소를 읽지 않는다.
  // 첫 구독 때만 저장한 설정을 읽어 새로고침 후에도 선택한 테마를 복원한다.
  if (!initialized) {
    try {
      currentTheme = normalizeTheme(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      // 저장소 접근이 제한된 브라우저에서도 메모리의 테마 값으로 계속 동작한다.
    }
    initialized = true;
  }

  function handleStorage(event: StorageEvent) {
    // 다른 탭에서 같은 사이트의 테마를 바꾸면 현재 탭도 갱신한다.
    if (event.storageArea !== window.localStorage) return;
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    currentTheme = normalizeTheme(event.newValue);
    onStoreChange();
  }

  // storage 이벤트는 변경한 탭 자신에게는 오지 않으므로 별도 이벤트도 사용한다.
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): Theme {
  return currentTheme;
}

function getServerSnapshot(): Theme {
  // 서버 HTML과 첫 hydration의 값을 동일하게 해 화면 불일치 오류를 방지한다.
  // 저장된 다크 설정은 브라우저 구독 이후 복원된다.
  return "light";
}

function setTheme(nextTheme: Theme) {
  currentTheme = nextTheme;

  // 특정 페이지가 아니라 최상위 html에 설정해 모든 페이지에 적용한다.
  document.documentElement.dataset.theme = nextTheme;

  try {
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  } catch {
    // 저장에 실패해도 현재 실행 중인 화면과 페이지 이동에서는 테마가 유지된다.
  }

  // 공통 테마를 구독 중인 버튼과 화면에 변경 사실을 알린다.
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { theme, setTheme };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  useEffect(() => {
    // 저장한 테마 복원 또는 다른 탭의 변경에도 전역 CSS 색상을 갱신한다.
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return <>{children}</>;
}
