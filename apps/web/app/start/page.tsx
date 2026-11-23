"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { loadAccount } from "../academic-account";
import { change, errorMessage, isStale, requiresLogin, uploadFiles, validateFile } from "../api-client";
import type { Department, FileKind, Profile, Warning } from "../api-client";
import { useApi } from "../use-api";
import { pretendard } from "../fonts/pretendard";
import { WeatherIcon } from "../weather-icon";
import styles from "./page.module.css";

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
const STARS = [[14, 12], [33, 30], [67, 10], [86, 34], [48, 22], [24, 62], [74, 56]];
const button = `${styles.cta} ${styles.tap}`;

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

export default function StartPage() {
  const account = useApi(loadAccount);

  return (
    <div className={`${pretendard.variable} ${styles.page}`}>
      <main className={styles.screen}>
        {account.data ? (
          <Onboarding
            initialProfile={account.data.me.profile}
            initialCompleted={account.data.me.profileCompleted}
            departments={account.data.departments}
            initialWarnings={account.data.warnings}
            reload={account.reload}
          />
        ) : (
          <div className={styles.card}>
            {account.error ? <>
              <p role="alert">{account.error}</p>
              <button type="button" className={button} onClick={account.reload}>다시 시도</button>
            </> : <p role="status">학적 정보를 불러오는 중…</p>}
          </div>
        )}
      </main>
    </div>
  );
}

function Onboarding({ initialProfile, initialCompleted, departments, initialWarnings, reload }: {
  initialProfile: Profile | null;
  initialCompleted: boolean;
  departments: Department[];
  initialWarnings: Warning[];
  reload: () => void;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [step, setStep] = useState(initialCompleted ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [warnings, setWarnings] = useState(initialWarnings);
  const [profile, setProfile] = useState(initialProfile);
  const [files, setFiles] = useState<Partial<Record<FileKind, File | null>>>({});
  const [result, setResult] = useState<{ parsed: number; saved: number }>();

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      if (requiresLogin(failure)) router.replace("/login?reason=session");
      else {
        setStale(isStale(failure));
        setError(errorMessage(failure));
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const volunteerHours = String(fields.get("volunteerHours") ?? "").trim();
    const examType = String(fields.get("examType") ?? "").trim();
    const score = String(fields.get("score") ?? "").trim();
    const grade = String(fields.get("grade") ?? "").trim();
    if ((examType || score || grade) && (!examType || (!score && !grade))) {
      setError("어학성적을 추가하려면 시험명과 점수 또는 등급을 입력해 주세요.");
      return;
    }
    void run(async () => {
      const response = await change<{ profile: Profile }>("users/me/profile", "PATCH", {
        departmentId: fields.get("departmentId"),
        admissionYear: Number(fields.get("admissionYear")),
        curriculumYear: Number(fields.get("curriculumYear")),
        expectedRevision: profile?.revision ?? 0,
        ...(volunteerHours && { volunteerHours: Number(volunteerHours) }),
        ...(examType && { languageScores: [...(profile?.languageScores ?? []),
          { examType, score: score ? Number(score) : null, grade: grade || null, takenAt: null }] }),
      });
      setProfile(response.data.profile);
      setWarnings(response.meta.warnings ?? []);
      setStep(2);
    });
  }

  function selectFile(kind: FileKind, file?: File) {
    if (lock.current || !file) return;
    const invalid = validateFile(kind, file);
    setError(invalid);
    setResult(undefined);
    setFiles((state) => ({ ...state, [kind]: invalid ? null : file }));
  }

  function submitFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.grades && !files.timetable) return;
    void run(async () => {
      const response = await uploadFiles(files);
      setResult(response.data);
      setFiles({});
    });
  }

  const back = step === 1
    ? <Link className={styles.back} href="/login">로그인</Link>
    : <Link className={styles.back} href="/">홈</Link>;

  return (
    <section className={styles.view}>
      <SkyHead step={step} title={step === 1 ? "학적 정보" : "성적 입력"} back={back} />
      {warnings.map((warning) => <p key={warning.code} role="status">{warning.message}</p>)}
      {step === 1 ? (
        <form onSubmit={save} className={styles.stack}>
          <fieldset className={styles.card} disabled={busy || stale || departments.length === 0}>
            <div className={styles.field}>
              <label htmlFor="sDept">학과</label>
              <select id="sDept" name="departmentId" required defaultValue={profile?.departmentId ?? ""}>
                <option value="" disabled>학과 선택</option>
                {departments.map((department) => (
                  <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="sYear">입학연도</label>
              <select id="sYear" name="admissionYear" required defaultValue={profile?.admissionYear ?? ""}>
                <option value="" disabled>입학연도 선택</option>
                {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="sCurriculum">적용 교육과정 연도</label>
              <input id="sCurriculum" name="curriculumYear" type="number" min="1900" max="9999" required defaultValue={profile?.curriculumYear ?? ""} />
            </div>
            <div className={styles.field}>
              <label htmlFor="sVolunteer">봉사시간 (선택)</label>
              <input id="sVolunteer" name="volunteerHours" type="number" min="0" max="99999.9" step="0.1" />
            </div>
            <details className={styles.field}>
              <summary>어학성적 추가 (선택)</summary>
              <label htmlFor="sExam">시험명</label>
              <input id="sExam" name="examType" maxLength={100} />
              <label htmlFor="sScore">점수</label>
              <input id="sScore" name="score" type="number" min="0" step="any" />
              <label htmlFor="sGrade">등급</label>
              <input id="sGrade" name="grade" maxLength={100} />
            </details>
          </fieldset>
          {departments.length === 0 && <p role="status">등록된 학과가 없습니다.</p>}
          <button className={button} type="submit" disabled={busy || stale || departments.length === 0}>
            {busy ? "저장 중…" : "저장하고 다음"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitFiles} className={styles.stack}>
          <fieldset className={styles.card} disabled={busy}>
            <div className={styles.field}>
              <label htmlFor="sGrades">전체성적조회 성적표 (XLSX)</label>
              <input type="file" id="sGrades" accept=".xlsx" onChange={(e) => {
                selectFile("grades", e.currentTarget.files?.[0]);
                e.currentTarget.value = "";
              }} />
              {files.grades && <p>{files.grades.name}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="sTimetable">수강신청확인서 (PDF, 선택)</label>
              <input type="file" id="sTimetable" accept=".pdf" onChange={(e) => {
                selectFile("timetable", e.currentTarget.files?.[0]);
                e.currentTarget.value = "";
              }} />
              {files.timetable && <p>{files.timetable.name}</p>}
            </div>
            <a href="https://portal.uos.ac.kr" target="_blank" rel="noopener">서울시립대 포털 열기</a>
          </fieldset>
          <button className={button} type="submit" disabled={busy || (!files.grades && !files.timetable)}>
            {busy ? "업로드 중…" : "파일 업로드"}
          </button>
          {result && <p role="status">{result.parsed}과목을 읽고 {result.saved}건을 저장했습니다.</p>}
          {!busy && <Link href="/grades" className={button}>{result ? "성적 조회" : "나중에 입력"}</Link>}
        </form>
      )}
      {error && <p className={styles.bad} role="alert">{error}</p>}
      {stale && <button className={button} type="button" onClick={reload}>학적 정보 다시 조회</button>}
    </section>
  );
}
