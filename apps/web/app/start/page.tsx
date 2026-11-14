"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ReactNode } from "react";
import { pretendard } from "../fonts/pretendard";
import { WeatherIcon } from "../weather-icon";
import styles from "./page.module.css";

type Row = { name: string; meta: string; division: string; flag?: boolean };

const FILE_TYPES = /\.(xlsx|xls|csv|pdf)$/i;
const YEARS = ["2026", "2025", "2024", "2023", "2022"];
const SEMESTERS = ["2026-2", "2026-1", "2025-2", "2025-1", "2024-2", "2024-1"];
const GRADES = ["A+", "A0", "B+", "B0", "C+", "C0", "D+", "D0", "F", "P"];
const GUIDE = ["포털 로그인 후 대학행정", "수업/성적에서 성적표 조회", "엑셀 또는 PDF로 저장", "저장한 파일 선택"];
const STARS = [[14, 12], [33, 30], [67, 10], [86, 34], [48, 22], [24, 62], [74, 56]];

const CATALOG = new Map<string, string>([
  ...["컴퓨터과학개론", "자료구조", "알고리즘", "컴퓨터구조", "운영체제 기초", "이산수학", "유닉스프로그래밍", "운영체제", "캡스톤디자인"].map((n) => [n, "전공필수"] as const),
  ...["대학영어", "미적분학", "일반물리", "선형대수"].map((n) => [n, "교양필수"] as const),
  ...["철학의 이해", "한국사의 이해", "논리와 사고", "현대미술의 이해", "도시와 환경", "글쓰기와 비평"].map((n) => [n, "교양선택"] as const),
  ...["진로탐색과 설계", "빅데이터처리", "도시와 건축", "서양미술사"].map((n) => [n, "일반선택"] as const),
  ...["이산구조 기초", "객체지향프로그래밍", "확률과통계", "프로그래밍언어론", "웹프로그래밍", "데이터베이스", "소프트웨어공학", "통계학입문", "컴퓨터그래픽스", "데이터통신", "데이터중심 머신러닝", "인공지능", "기계학습", "데이터마이닝", "컴퓨터네트워크"].map((n) => [n, "전공선택"] as const),
  ["공학경제", "공학소양"],
]);

const SAMPLE: Row[] = [
  { name: "미적분학", meta: "3학점, 2026-1 A0, 재수강으로 2024-1 C+ 기록 제외", division: "교양필수" },
  { name: "진로탐색과 설계", meta: "1학점, 2024-1 P, 평점 계산 제외", division: "일반선택" },
  { name: "빅데이터처리", meta: "3학점, 2025-2 A+, 빅데이터 초급 인정 과목", division: "일반선택" },
  { name: "컴퓨터과학개론", meta: "3학점, 2024-1 A+", division: "전공필수" },
];

function SkyHead({ step, title, back }: { step: number; title: string; back: ReactNode }) {
  return (
    <div className={styles.skyhead}>
      <div className={styles.stars} aria-hidden="true">
        {STARS.map(([left, top]) => <i key={`${left}-${top}`} style={{ left: `${left}%`, top: `${top}%` }} />)}
      </div>
      <span className={styles.orb} aria-hidden="true"><WeatherIcon sky="sun" /></span>
      {back}
      <header className={styles.lt}>
        <div>
          <div className={styles.sub}>{step}단계</div>
          <h1>{title}</h1>
        </div>
      </header>
      <div className={styles.prog}><i style={{ width: `${step * 50}%` }} /></div>
    </div>
  );
}

const CHEVRON = <svg className={styles.ico} viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" /></svg>;

export default function StartPage() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nameRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [year, setYear] = useState("2024");
  const [engineering, setEngineering] = useState(true);
  const [mode, setMode] = useState<"file" | "hand">("file");
  const [file, setFile] = useState<{ name: string; meta: string; ok: boolean } | null>(null);
  const [over, setOver] = useState(false);
  const [rows, setRows] = useState(SAMPLE);
  const [count, setCount] = useState(27);
  const [summary, setSummary] = useState(true);
  const [empty, setEmpty] = useState(true);
  const [name, setName] = useState("");
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [grade, setGrade] = useState(GRADES[0]);
  const [message, setMessage] = useState({ text: "", on: false });

  function toast(text: string) {
    setMessage({ text, on: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage((m) => ({ ...m, on: false })), 1800);
  }

  const welcome = useEffectEvent(() => toast("카카오 계정으로 가입했습니다"));

  useEffect(() => {
    const delay = setTimeout(() => welcome(), 0);
    return () => {
      clearTimeout(delay);
      clearTimeout(timer.current);
    };
  }, []);

  function takeFile(next: File | undefined) {
    if (!next) return;
    const ok = FILE_TYPES.test(next.name);
    setFile({
      name: next.name,
      meta: ok ? `${Math.max(1, Math.round(next.size / 1024))} KB, 27과목 인식` : "엑셀, CSV, PDF 파일만 올릴 수 있습니다",
      ok,
    });
    if (ok) setEmpty(false);
  }

  function addCourse() {
    const n = name.trim();
    if (!n) {
      toast("과목명을 입력하세요");
      nameRef.current?.focus();
      return;
    }
    const division = CATALOG.get(n);
    const row = { name: n, meta: `${semester} ${grade}${grade === "P" ? ", 평점 계산 제외" : ""}`, division: division ?? "확인 필요", flag: !division };
    if (empty) {
      setRows([row]);
      setCount(1);
      setSummary(false);
      setEmpty(false);
    } else {
      setRows((list) => [row, ...list]);
      setCount((c) => c + 1);
    }
    setName("");
    toast("추가했습니다");
  }

  const apply: [string, string | number][] = [[`${year}학년도 교육과정`, ""], ["졸업 최저 이수학점", 130], ["전공필수", 27], ["전공선택", 39], ["교양", 30]];
  if (engineering) apply.push(["공학소양", 3]);

  return (
    <div className={`${pretendard.variable} ${styles.page}`}>
      <main className={styles.screen}>
        {step === 1 ? (
          <section key="start" className={styles.view}>
            <SkyHead
              step={1}
              title="학과와 입학연도"
              back={<Link href="/login" className={`${styles.back} ${styles.tap}`}>{CHEVRON}로그인</Link>}
            />
            <div className={styles.g2}>
              <div className={`${styles.card} ${styles.flat}`}>
                <div className={styles.field}>
                  <label htmlFor="sDept">학과</label>
                  <select id="sDept" defaultValue="컴퓨터과학부">
                    <option>컴퓨터과학부</option>
                    <option disabled>전자전기컴퓨터공학부 (준비 중)</option>
                    <option disabled>통계학과 (준비 중)</option>
                    <option disabled>경영학부 (준비 중)</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="sYear">입학연도</label>
                  <select id="sYear" value={year} onChange={(e) => setYear(e.target.value)}>
                    {YEARS.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <div className={styles.lr}>
                    <b><label htmlFor="sAbeek">공학인증 이수 대상</label></b>
                    <input className={styles.sw} id="sAbeek" type="checkbox" checked={engineering} onChange={(e) => setEngineering(e.target.checked)} />
                  </div>
                </div>
              </div>
              <div className={styles.stack}>
                <div className={styles.card}>
                  <div className={styles.kv}>적용되는 기준</div>
                  <div className={styles.calc}>
                    {apply.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
                  </div>
                </div>
                <button className={`${styles.cta} ${styles.tap}`} type="button" onClick={() => setStep(2)}>다음</button>
              </div>
            </div>
          </section>
        ) : (
          <section key="up" className={styles.view}>
            <SkyHead
              step={2}
              title="성적 입력"
              back={<button className={`${styles.back} ${styles.tap}`} type="button" onClick={() => setStep(1)}>{CHEVRON}학과와 입학연도</button>}
            />
            <div className={styles.segctl} role="group" aria-label="성적 입력 방법">
              <button type="button" aria-pressed={mode === "file"} onClick={() => setMode("file")}>성적표 파일</button>
              <button type="button" aria-pressed={mode === "hand"} onClick={() => setMode("hand")}>직접 입력</button>
            </div>
            <div className={styles.g2}>
              <div className={styles.stack}>
                {mode === "file" ? (
                  <div key="file" className={`${styles.stack} ${styles.subview}`}>
                    <div className={styles.card}>
                      <label
                        className={over ? `${styles.drop} ${styles.over} ${styles.tap}` : `${styles.drop} ${styles.tap}`}
                        htmlFor="file"
                        onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
                        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
                        onDrop={(e) => { e.preventDefault(); setOver(false); takeFile(e.dataTransfer.files[0]); }}
                      >
                        <input type="file" id="file" accept=".xlsx,.xls,.csv,.pdf" onChange={(e) => takeFile(e.target.files?.[0])} />
                        <span className={styles.ic}><svg viewBox="0 0 24 24"><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg></span>
                        <b>성적표 파일 선택</b>
                        <span className={styles.hint}>엑셀, CSV, PDF</span>
                      </label>
                      {file && (
                        <div className={styles.file}>
                          <span className={styles.ic}>
                            <svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /></svg>
                          </span>
                          <span className={styles.tx}>
                            <b>{file.name}</b>
                            <span className={file.ok ? undefined : styles.bad} role={file.ok ? undefined : "alert"}>{file.meta}</span>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={styles.card}>
                      <div className={styles.ct}><h2>성적표 파일 받는 법</h2></div>
                      <ol className={styles.steps}>{GUIDE.map((s) => <li key={s}>{s}</li>)}</ol>
                      <a className={`${styles.cta} ${styles.tint} ${styles.tap}`} href="https://portal.uos.ac.kr" target="_blank" rel="noopener">포털 열기</a>
                    </div>
                  </div>
                ) : (
                  <div key="hand" className={`${styles.card} ${styles.subview}`}>
                    <div className={`${styles.field} ${styles.first}`}>
                      <label htmlFor="hName">과목명</label>
                      <input
                        ref={nameRef}
                        type="text"
                        id="hName"
                        list="catalog"
                        placeholder="과목명 검색"
                        autoComplete="off"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <datalist id="catalog">{[...CATALOG.keys()].map((n) => <option key={n} value={n} />)}</datalist>
                    <div className={styles.addg}>
                      <select aria-label="수강 학기" value={semester} onChange={(e) => setSemester(e.target.value)}>
                        {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <select aria-label="성적" value={grade} onChange={(e) => setGrade(e.target.value)}>
                        {GRADES.map((g) => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                    <button className={`${styles.cta} ${styles.add} ${styles.tap}`} type="button" onClick={addCourse}>추가</button>
                  </div>
                )}
              </div>
              <div className={styles.stack}>
                {!empty && (
                  <div className={styles.card}>
                    <div className={styles.ct}><h2>불러온 과목</h2></div>
                    <p className={styles.ctext}>{count}과목{summary && ", 79학점, 재수강 1과목"}</p>
                    <div>
                      {rows.map((r, i) => (
                        <div key={`${r.name}-${rows.length - i}`} className={r.flag ? `${styles.urow} ${styles.flag}` : styles.urow}>
                          <span className={styles.tx}><b>{r.name}</b><span>{r.meta}</span></span>
                          <span className={styles.dv}>{r.division}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className={styles.dock}>
                  <button className={`${styles.cta} ${styles.tap}`} type="button" disabled={empty} onClick={() => router.push("/")}>시작하기</button>
                  <p className={styles.note}>성적은 내 계정에 저장됩니다</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <div className={message.on ? `${styles.toast} ${styles.on}` : styles.toast} role="status">{message.text}</div>
    </div>
  );
}
