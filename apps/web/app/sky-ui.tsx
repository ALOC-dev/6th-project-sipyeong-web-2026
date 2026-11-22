"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { pretendard } from "./fonts/pretendard";
import { WeatherIcon } from "./weather-icon";
import type { Sky } from "./weather-icon";
import s from "./sky.module.css";

export { s };
export const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

const NAV: [string, string, ReactNode, string?][] = [
  ["/", "홈", <path key="p" d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />],
  ["/req", "졸업요건", <><path d="M10 6h10M10 12h10M10 18h10" /><path d="m3.5 6 1.5 1.5L8 4.5M3.5 12l1.5 1.5L8 10.5M3.5 18l1.5 1.5L8 16.5" /></>],
  ["/md", "마이크로디그리", <><circle cx="12" cy="9" r="5" /><path d="M9 13.5 7.5 21 12 18.5 16.5 21 15 13.5" /></>, "디그리"],
  ["/road", "로드맵", <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8" /></>],
  ["/grade", "학점", <path key="p" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />],
  ["/my", "내 정보", <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.4-3.8 4.4-6 8-6s6.6 2.2 8 6" /></>],
];
const STARS = [[14, 12], [33, 30], [67, 10], [86, 34], [48, 22], [24, 62], [74, 56]];
const ico = (p: ReactNode) => <svg className={s.ico} viewBox="0 0 24 24" aria-hidden="true">{p}</svg>;

export const Chev = () => <svg className={s.chev} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;
export const XIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;

export function Shell({ at, children }: { at: string; children: ReactNode }) {
  return (
    <div className={`${s.page} ${pretendard.variable}`}>
      <aside className={s.rail} aria-label="메뉴">
        <div className={s.logo}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17a5 5 0 0 1 10 0Z" fill="#FFC83D" /><path d="M12 7.5v2M17.3 11.7l1.4-1.4M6.7 11.7l-1.4-1.4" stroke="#FFC83D" strokeWidth="2" strokeLinecap="round" /><path d="M2.5 17h19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          시평
        </div>
        {NAV.map(([href, label, p]) => <Link key={href} className={s.nv} href={href} aria-current={href === at ? "page" : undefined}>{ico(p)}{label}</Link>)}
        <div className={s.foot}>
          <Link className={cx(s.cta, s.tap)} href="/start">성적표 올리기</Link>
          <div className={s.me}><b>컴퓨터과학부 2024학번</b>10.31 성적표 반영</div>
        </div>
      </aside>
      <main className={s.screen}>{children}</main>
      <nav className={s.tabbar} aria-label="화면">
        {NAV.map(([href, label, p, short]) => <Link key={href} href={href} aria-current={href === at ? "page" : undefined}>{ico(p)}{short ?? label}</Link>)}
      </nav>
    </div>
  );
}

export function SkyHead({ sub, title, foot, children }: { sub: string; title: string; foot: [ReactNode, ReactNode]; children?: ReactNode }) {
  return (
    <div className={s.skyhead}>
      <div className={s.stars} aria-hidden="true">
        {STARS.map(([left, top]) => <i key={`${left}-${top}`} style={{ left: `${left}%`, top: `${top}%` }} />)}
      </div>
      <span className={s.orb} aria-hidden="true"><WeatherIcon sky="sun" /></span>
      <header className={s.lt}><div className={s.sub}>{sub}</div><h1>{title}</h1></header>
      <div className={s.skFoot}><span>{foot[0]}</span><span>{foot[1]}</span></div>
      {children}
    </div>
  );
}

export function Sheet({ open, label, title, onClose, children }: { open: boolean; label?: string; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={s.sheet} aria-label={label ?? title} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {open && (
        <div className={s.in}>
          <div className={s.grab} />
          <button className={cx(s.xbtn, s.tap)} type="button" aria-label="닫기" onClick={onClose}><XIcon /></button>
          <h3 className={s.csH}>{title}</h3>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function useToast() {
  const [msg, setMsg] = useState({ text: "", on: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = (text: string) => {
    clearTimeout(timer.current);
    setMsg({ text, on: true });
    timer.current = setTimeout(() => setMsg((m) => ({ ...m, on: false })), 1800);
  };
  const node = <div className={cx(s.toast, msg.on && s.on)} role="status">{msg.text}</div>;
  return [toast, node] as const;
}

type HelpRow = ["i", Sky, string] | ["k", string, string] | ["h", string] | ["s", string, string];
const LEG: HelpRow[] = [["i", "sun", "4.0 이상"], ["i", "sunc", "3.7 이상"], ["i", "cloud", "3.5 이상"], ["i", "rain", "3.5 미만"]];
export const HELP: Record<string, [string, ...HelpRow[]]> = {
  sems: ["학기별 평점", ...LEG, ["h", "기준"], ["k", "지난 학기", "취득 평점"], ["k", "이번 학기", "플래너 목표 평점"], ["k", "이후 학기", "평점 계획의 남은 학기 평균"]],
  check: ["요건별 상태", ["i", "sun", "충족"], ["i", "sunc", "충족 예정 (이번 학기 수강 포함)"], ["i", "cloud", "미충족"],
    ["h", "막대"], ["s", "ok", "충족"], ["s", "", "인정 학점"], ["s", "l", "이번 학기 수강 중"], ["k", "양끝 숫자", "인정 학점, 기준 학점"], ["k", "외국어 인증, 사회봉사", "눌러서 직접 입력"]],
  calc: ["인정 학점 계산", ["k", "제외", "재수강 이전 기록"], ["k", "제외", "교양 인정 한도 초과 학점"], ["k", "P/F", "학점 인정, 평점 제외"]],
  goal: ["평점 계획", ["k", "목표 평점", "졸업 시 전체 평점"], ["k", "남은 학기 평균", "목표 평점에 필요한 평균"], ["k", "과목 기준", "전공 4.1 이상, 교양 3.9 이상"]],
};

export function HelpRows({ k }: { k: string }) {
  return HELP[k].slice(1).map((r, i) => {
    const row = r as HelpRow;
    if (row[0] === "h") return <div key={i} className={s.hh}>{row[1]}</div>;
    if (row[0] === "k") return <div key={i} className={cx(s.hrow, s.hkv)}><span>{row[1]}</span><b>{row[2]}</b></div>;
    return (
      <div key={i} className={s.hrow}>
        {row[0] === "i" ? <WeatherIcon sky={row[1]} /> : <i className={cx(s.hsw, row[1] === "ok" && s.ok, row[1] === "l" && s.l)} />}
        <span>{row[2]}</span>
      </div>
    );
  });
}

export const Qm = ({ k, label, onHelp }: { k: string; label: string; onHelp: (k: string) => void }) => (
  <button className={s.qm} type="button" aria-label={`${label} 설명 보기`} onClick={() => onHelp(k)}>?</button>
);
