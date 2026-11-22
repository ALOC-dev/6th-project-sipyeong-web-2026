import { useSyncExternalStore } from "react";
import type { Sky } from "./weather-icon";

export type Item = {
  n: string; d?: number; p?: number; need?: number; u?: string; tag?: string;
  miss?: string[]; prog?: string[]; ok?: boolean; v?: string; ex?: "lang" | "vol"; own?: boolean;
};
export type Course = [name: string, div: string, memo: string, md: string, cr?: number, own?: number];
export type Sem = { t: string; want?: number; c: Course[] };
export type Road = { id: string; name: string; at: number; sems: Sem[] };
export type Roads = { list: Road[]; main: string | null };
export type Extra = { lang?: { t: string; s: number }; vol?: number };
type Feat = { left?: [string, number]; next?: string; yr?: [number, number]; deg?: [string, number, number]; pre?: [string, string] };
export type Rec = { n: string; d: string; off: string; memo?: string; md?: string; f: Feat };
export type Tag = [cls: string, text: string, score: number];

export const BASE_ITEMS: Item[] = [
  { n: "총 이수학점", d: 76, p: 21, need: 130 },
  { n: "전공필수", d: 15, p: 6, need: 27, miss: ["운영체제", "캡스톤디자인"], prog: ["이산수학", "유닉스프로그래밍"] },
  { n: "전공선택", d: 27, p: 9, need: 39 },
  { n: "교양필수", d: 12, p: 0, need: 12 },
  { n: "교양선택", d: 15, p: 3, need: 18, prog: ["글쓰기와 비평"] },
  { n: "공학소양", d: 0, p: 0, need: 3, tag: "공학인증" },
  { n: "평점평균", ok: true, v: "3.78 (기준 2.00)" },
  { n: "외국어 인증", ok: false, v: "미제출", ex: "lang" },
  { n: "사회봉사", d: 0, p: 0, need: 20, u: "시간", ex: "vol" },
];
export const LANG: [string, number, number][] = [["TOEIC", 700, 990], ["TOEFL iBT", 80, 120], ["TEPS", 327, 600]];

export function withExtra(extra: Extra): Item[] {
  return BASE_ITEMS.map((it) => {
    if (it.ex === "lang") {
      const l = extra.lang, t = l && LANG.find((x) => x[0] === l.t);
      return { ...it, ok: !!t && l.s >= t[1], v: t ? `${l.t} ${l.s} (기준 ${t[1]})` : "미제출", own: !!t };
    }
    if (it.ex === "vol") return { ...it, d: extra.vol ?? 0, own: extra.vol != null };
    return it;
  });
}
export const state = (it: Item) => it.need ? (it.d! >= it.need ? "ok" : it.d! + it.p! >= it.need ? "soon" : "") : it.ok ? "ok" : "";

export const SEMS: [string, number][] = [["2024-1", 3.62], ["2024-2", 3.71], ["2025-1", 3.8], ["2025-2", 3.69], ["2026-1", 4.05]];
export const sky = (g: number): Sky => g >= 4 ? "sun" : g >= 3.7 ? "sunc" : g >= 3.5 ? "cloud" : "rain";

export const NOW: { t: string; cr: number; c: Course[] } = { t: "2026-2", cr: 21, c: [
  ["이산수학", "전공필수", "", ""], ["유닉스프로그래밍", "전공필수", "", ""], ["데이터통신", "전공선택", "", "이수 시 차세대통신 초급 취득"],
  ["데이터중심 머신러닝", "전공선택", "", ""], ["인공지능", "전공선택", "", "머신러닝 입문 인정 과목"], ["글쓰기와 비평", "교양선택", "", ""], ["서양미술사", "교양선택", "", ""]] };
export const FUT = ["2027-1", "2027-2"], GRAD_SEM = FUT[FUT.length - 1], MAX_CR = 20, PLAN_G = "전공 4.1 이상, 교양 3.9 이상";
export const LEFT = 130 - 76 - 21;
const TARGET = [4, 1];

export const REC: Rec[] = [
  { n: "운영체제", d: "전공필수", off: "1", memo: "3학년 1학기 권장", f: { left: ["전공필수", 6], next: "2028-1", yr: [3, 1] } },
  { n: "캡스톤디자인", d: "전공필수", off: "2", memo: "4학년 2학기 권장", f: { left: ["전공필수", 6], yr: [4, 2] } },
  { n: "기계학습", d: "전공선택", off: "1", md: "이수 시 머신러닝 입문 취득", f: { deg: ["머신러닝 입문", 3, 4], pre: ["확률과통계", "y"], yr: [4, 1] } },
  { n: "데이터마이닝", d: "전공선택", off: "1", memo: "격년 개설", md: "빅데이터 중급 인정 과목", f: { deg: ["빅데이터 중급", 1, 4], next: "2029-1", yr: [4, 1] } },
  { n: "분산처리시스템", d: "전공선택", off: "2", md: "빅데이터 중급 인정 과목", f: { deg: ["빅데이터 중급", 1, 4], pre: ["데이터베이스", "y"], yr: [4, 2] } },
  { n: "컴퓨터비전", d: "전공선택", off: "1", f: { pre: ["인공지능", "p"], yr: [4, 1] } },
  { n: "컴퓨터네트워크", d: "전공선택", off: "2", memo: "2학기 개설", f: { yr: [4, 2] } },
  { n: "공학경제", d: "공학소양", off: "2", f: { left: ["공학소양", 3], yr: [3, 2] } },
  { n: "기술과 사회", d: "공학소양", off: "*", f: { left: ["공학소양", 3] } },
];
const yrCmp = ([y, s]: [number, number]) => (y - TARGET[0]) * 2 + (s - TARGET[1]);
export const recTags = (f: Feat): Tag[] => [
  f.left && ["pri", `${f.left[0]} ${f.left[1]}학점 미이수`, f.left[0] === "전공필수" ? 5 : f.left[0] === "공학소양" ? 2 : 1],
  f.next && (f.next > GRAD_SEM ? ["warn", "졸업 전 마지막 개설", 3] : ["", `다음 개설 ${f.next}`, 1]),
  f.yr && yrCmp(f.yr) < 0 && ["warn", "권장 학기 지남", 2],
  f.yr && yrCmp(f.yr) === 0 && ["", `${TARGET[0]}학년 ${TARGET[1]}학기 권장`, 1],
  f.deg && (f.deg[1] + 1 === f.deg[2] ? ["ok", `이수 시 ${f.deg[0]} 취득`, 4] : ["ok", `${f.deg[0]} 인정 과목`, 3]),
  f.pre && ["", f.pre[1] === "y" ? `선수과목 ${f.pre[0]} 이수` : `${f.pre[0]} 후속 과목`, 1],
].filter(Boolean) as Tag[];
const score = (r: Rec) => recTags(r.f).reduce((a, t) => a + t[2], 0);
REC.sort((a, b) => score(b) - score(a));
export const GY: Rec[] = ["심리학의 이해", "경제학의 이해", "현대사회와 윤리", "세계사의 이해", "음악의 이해"].map((n, i) => ({ n, d: "교양선택", off: i === 1 ? "1" : "*", f: {} }));
export const ALLC = [...REC, ...GY];
export const offers = (r: Rec, t: string) => r.off === "*" || r.off === t.slice(5);
export const topTags = (r: Rec, k = 2, pre: Tag[] = []) => [...pre, ...recTags(r.f)].sort((a, b) => b[2] - a[2]).slice(0, k);

export const crOf = (s: { c: Course[] }) => s.c.reduce((a, c) => a + (c[4] ?? 3), 0);
export const fmt = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}.${d.getDate()}`; };
export const obj = (s: string) => { const c = s.charCodeAt(s.length - 1) - 0xac00; return s + (c < 0 || c > 11171 ? "을(를)" : c % 28 ? "을" : "를"); };

export function evenSplit() {
  const u = Math.round(LEFT / 3), n = FUT.length;
  return FUT.map((_, i) => Math.min(MAX_CR, (Math.floor(u / n) + (i < u % n ? 1 : 0)) * 3));
}

export function recommend(want: number[], keep?: Road): Sem[] {
  const sems: Sem[] = FUT.map((t, i) => ({ t, want: want[i], c: (keep?.sems.find((s) => s.t === t)?.c ?? []).filter((c) => c[5]).map((c) => [...c] as Course) }));
  const has = (n: string) => sems.some((s) => s.c.some((c) => c[0] === n)), room = (s: Sem) => s.want! - crOf(s);
  const planned = (d: string) => sems.reduce((a, s) => a + s.c.filter((c) => c[1] === d).reduce((x, c) => x + (c[4] ?? 3), 0), 0);
  const put = (r: Rec, must: boolean) => {
    const ok = sems.filter((s) => offers(r, s.t) && (must ? crOf(s) + 3 <= MAX_CR : room(s) >= 3));
    if (has(r.n) || !ok.length) return;
    ok.reduce((a, b) => room(b) > room(a) ? b : a).c.push([r.n, r.d, r.memo ?? "", r.md ?? "", 3]);
  };
  BASE_ITEMS.filter((i) => i.need && !i.u && i !== BASE_ITEMS[0]).forEach((i) => {
    for (const r of REC.filter((x) => x.d === i.n)) if (i.need! - i.d! - i.p! - planned(i.n) > 0) put(r, true);
  });
  REC.filter((r) => r.d === "전공선택").forEach((r) => put(r, false));
  sems.forEach((s) => { const g = room(s); if (g > 0) s.c.push(["*교양선택", "교양선택", "", "", g]); });
  return sems;
}

export function gaps(sems: Sem[]) {
  const all = sems.flatMap((s) => s.c), cr = (d: string) => all.filter((c) => c[1] === d).reduce((a, c) => a + (c[4] ?? 3), 0), out: string[] = [];
  const tot = 97 + all.reduce((a, c) => a + (c[4] ?? 3), 0);
  if (tot < 130) out.push(`졸업까지 ${130 - tot}학점 부족`);
  BASE_ITEMS.filter((i) => i.need && !i.u && i !== BASE_ITEMS[0] && i.n !== "전공필수").forEach((i) => { const l = i.need! - i.d! - i.p! - cr(i.n); if (l > 0) out.push(`${i.n} ${l}학점 부족`); });
  BASE_ITEMS[1].miss!.filter((n) => !all.some((c) => c[0] === n)).forEach((n) => out.push(`전공필수 ${n} 빠짐`));
  sems.forEach((s) => s.c.forEach((c) => { const p = REC.find((x) => x.n === c[0]); if (p && !offers(p, s.t)) out.push(`${c[0]}, ${p.off}학기에만 개설`); }));
  return out;
}

export function newRoad(list: Road[], sems: Sem[]): Road {
  const at = Date.now(), base = `${fmt(at)} 로드맵`;
  let name = base;
  for (let i = 2; list.some((r) => r.name === name); i++) name = `${base} ${i}`;
  return { id: at.toString(36), name, at, sems };
}

export function fillSlot(s: Sem, d: string, cr: number) {
  const slot = s.c.find((c) => c[0] === "*교양선택");
  if (d !== "교양선택" || !slot) return;
  slot[4] = (slot[4] ?? 3) - cr;
  if (slot[4] <= 0) s.c.splice(s.c.indexOf(slot), 1);
}

function stored<T>(key: string, init: T) {
  let cur: T | undefined;
  const subs = new Set<() => void>();
  const get = () => {
    if (cur === undefined) {
      try { cur = JSON.parse(localStorage.getItem(key) ?? "null") ?? init; } catch { cur = init; }
    }
    return cur as T;
  };
  const set = (v: T) => {
    cur = v;
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
    subs.forEach((f) => f());
  };
  const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
  return { set, use: () => useSyncExternalStore(subscribe, get, () => init) };
}
export const extraStore = stored<Extra>("extra", {});
export const roadStore = stored<Roads>("roads", { list: [], main: null });
