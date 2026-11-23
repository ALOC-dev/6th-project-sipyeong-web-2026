import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pretendard } from "./fonts/pretendard";
import { ThemeProvider } from "./theme-provider";
import { AppShell } from "./app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "시평",
  description: "서울시립대학교 학업 현황과 성적 기록",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 모든 페이지를 감싸므로 이동·새로고침 후에도 공통 테마를 적용한다. */}
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
