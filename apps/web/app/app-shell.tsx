"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { SAMPLE_GRADE_FILE } from "./grade-file-info";
import { AppIcon, BrandMark } from "./app-icon";
import type { AppIconName } from "./app-icon";
import { ComingSoonDialog } from "./coming-soon-dialog";
import { useStudentProfile } from "./profile-provider";
import styles from "./app-shell.module.css";

const navigation: { label: string; mobileLabel?: string; icon: AppIconName; href?: string }[] = [
  { label: "홈", icon: "home", href: "/" },
  { label: "졸업요건", icon: "checklist" },
  { label: "마이크로디그리", mobileLabel: "디그리", icon: "award", href: "/degrees" },
  { label: "로드맵", icon: "road" },
  { label: "학점", icon: "chart", href: "/grades" },
  { label: "내 정보", icon: "user", href: "/my" },
];

// 메뉴를 layout에 한 번만 배치한다. PC는 왼쪽, 모바일은 하단 메뉴를 사용한다.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profile } = useStudentProfile();
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  function menu(mobile: boolean) {
    return navigation.map((item) => {
      const content = <><AppIcon name={item.icon} /><span>{mobile ? item.mobileLabel ?? item.label : item.label}</span></>;
      if (!item.href) return <button key={item.label} type="button" onClick={() => setComingSoon(item.label)}>{content}</button>;
      const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
      return <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} onClick={(event) => {
        // 디그리 페이지에 이미 머물러 있을 때도 안내창을 다시 열 수 있다.
        if (item.href === "/degrees" && pathname === "/degrees") {
          event.preventDefault(); setComingSoon("마이크로디그리");
        }
      }}>{content}</Link>;
    });
  }

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}><BrandMark /><span>시평</span></Link>
      <nav className={styles.desktopMenu} aria-label="주 메뉴">{menu(false)}</nav>
      <div className={styles.footer}>
        <Link href="/my?upload=grades" className={styles.uploadButton}>성적표 올리기</Link>
        <Link href="/my" className={styles.profile}>
          <strong>{profile.department} {profile.admissionYear}학번</strong>
          {/* 원본 HTML처럼 성적표 반영일을 표시하며 내 정보와 같은 값을 읽는다. */}
          <span>{SAMPLE_GRADE_FILE.appliedAt} 성적표 반영</span>
        </Link>
      </div>
    </aside>
    <div className={styles.workspace}>{children}</div>
    <nav className={styles.mobileMenu} aria-label="주 메뉴">{menu(true)}</nav>
    {comingSoon && <ComingSoonDialog feature={comingSoon} onClose={() => setComingSoon(null)} />}
  </div>;
}
