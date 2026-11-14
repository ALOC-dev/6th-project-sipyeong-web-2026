"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import styles from "./page.module.css";

type Course = { name: string; semester: string; grade: string };

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEPARTMENTS = ["컴퓨터과학부"];
const GRADES = ["A+", "A0", "B+", "B0", "C+", "C0", "D+", "D0", "F", "P"];
const GUIDE = ["대학행정 접속", "수업/성적의 성적표조회", "전체성적조회 선택", "Excel 다운로드"];

const today = new Date();
const thisYear = today.getFullYear();
const thisTerm = today.getMonth() >= 7 ? 2 : 1;
const YEARS = Array.from({ length: 8 }, (_, i) => String(thisYear - i));

function semestersSince(year: string) {
  const list: string[] = [];
  for (let y = Number(year); y <= thisYear; y++) {
    for (const term of [1, 2]) {
      if (y === thisYear && term >= thisTerm) return list;
      list.push(`${y}-${term}`);
    }
  }
  return list;
}

function checkFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return ".xlsx 파일만 선택할 수 있습니다.";
  if (file.size === 0) return "내용이 없는 파일입니다.";
  if (file.size > MAX_FILE_SIZE) return "10MB 이하 파일만 선택할 수 있습니다.";
  return "";
}

export default function StartPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [engineering, setEngineering] = useState(true);
  const [mode, setMode] = useState<"file" | "hand">("file");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [draft, setDraft] = useState<Course>({ name: "", semester: "", grade: "A+" });

  const semesters = year ? semestersSince(year) : [];
  const draftSemester = draft.semester || semesters[semesters.length - 1] || "";
  const ready = file !== null || courses.length > 0;

  function selectFile(next: File | undefined) {
    if (!next) return;
    const error = checkFile(next);
    setFileError(error);
    if (!error) setFile(next);
  }

  function addCourse() {
    const name = draft.name.trim();
    if (!name || !draftSemester) return;
    setCourses((list) => [...list, { name, semester: draftSemester, grade: draft.grade }]);
    setDraft((d) => ({ ...d, name: "" }));
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        {step === 1 ? (
          <Link href="/login" className={styles.back}>‹ 로그인</Link>
        ) : (
          <button type="button" className={styles.back} onClick={() => setStep(1)}>‹ 학과와 입학연도</button>
        )}
        <p className={styles.eyebrow}>{step}단계</p>
        <h1>{step === 1 ? "학과와 입학연도" : "성적 입력"}</h1>
        <div className={styles.progress}><i style={{ width: step === 1 ? "50%" : "100%" }} /></div>
      </header>

      {step === 1 ? (
        <form
          className={styles.content}
          onSubmit={(event) => {
            event.preventDefault();
            setStep(2);
          }}
        >
          <section className={styles.card}>
            <label className={styles.field}>
              <span>학과</span>
              <select required value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="" disabled>선택</option>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>입학연도</span>
              <select required value={year} onChange={(e) => { setYear(e.target.value); setDraft((d) => ({ ...d, semester: "" })); }}>
                <option value="" disabled>선택</option>
                {YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
            <label className={styles.switchRow}>
              <span>공학인증 이수 대상</span>
              <input type="checkbox" checked={engineering} onChange={(e) => setEngineering(e.target.checked)} />
            </label>
          </section>
          <button type="submit" className={styles.primary} disabled={!department || !year}>다음</button>
        </form>
      ) : (
        <div className={styles.content}>
          <div className={styles.segment} role="group" aria-label="성적 입력 방법">
            <button type="button" aria-pressed={mode === "file"} onClick={() => setMode("file")}>성적표 파일</button>
            <button type="button" aria-pressed={mode === "hand"} onClick={() => setMode("hand")}>직접 입력</button>
          </div>

          {mode === "file" ? (
            <section className={styles.card}>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                hidden
                aria-label="성적 Excel 파일 선택"
                onChange={(event) => {
                  selectFile(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <div
                className={styles.drop}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (event.dataTransfer.files.length !== 1) {
                    setFileError("파일은 한 개만 선택할 수 있습니다.");
                    return;
                  }
                  selectFile(event.dataTransfer.files[0]);
                }}
              >
                <strong>성적 Excel</strong>
                <span>.xlsx, 최대 10MB</span>
                <button type="button" className={styles.secondary} onClick={() => inputRef.current?.click()}>
                  {file ? "다른 파일 선택" : "파일 선택"}
                </button>
              </div>
              {fileError && <p className={styles.error} role="alert">{fileError}</p>}
              {file && (
                <div className={styles.picked} aria-live="polite">
                  <div>
                    <strong>{file.name}</strong>
                    <span>{(file.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <button type="button" className={styles.text} onClick={() => setFile(null)}>선택 취소</button>
                </div>
              )}
              <details className={styles.guide}>
                <summary>성적 파일 받는 법</summary>
                <ol>{GUIDE.map((s) => <li key={s}>{s}</li>)}</ol>
              </details>
            </section>
          ) : (
            <section className={styles.card}>
              <label className={styles.field}>
                <span>과목명</span>
                <input
                  type="text"
                  value={draft.name}
                  placeholder="과목명"
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") addCourse(); }}
                />
              </label>
              <div className={styles.pair}>
                <label className={styles.field}>
                  <span>수강 학기</span>
                  <select value={draftSemester} onChange={(e) => setDraft((d) => ({ ...d, semester: e.target.value }))}>
                    {semesters.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>성적</span>
                  <select value={draft.grade} onChange={(e) => setDraft((d) => ({ ...d, grade: e.target.value }))}>
                    {GRADES.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" className={styles.secondary} onClick={addCourse} disabled={!draft.name.trim() || !draftSemester}>추가</button>
              {courses.length > 0 && (
                <ul className={styles.courses}>
                  {courses.map((c, i) => (
                    <li key={`${c.name}-${c.semester}-${i}`}>
                      <div><strong>{c.name}</strong><span>{c.semester} {c.grade}</span></div>
                      <button type="button" className={styles.text} onClick={() => setCourses((list) => list.filter((_, j) => j !== i))}>삭제</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <button type="button" className={styles.primary} disabled={!ready} onClick={() => router.push("/")}>시작하기</button>
          <p className={styles.note}>성적은 내 계정에 저장됩니다</p>
        </div>
      )}
    </main>
  );
}
