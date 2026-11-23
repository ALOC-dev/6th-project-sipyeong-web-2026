"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { loadAccount, type CurriculumRule } from "../academic-account";
import { TimetableTermSelect, uploadInfo } from "../academic-upload";
import { change, errorMessage, isStale, requiresLogin, uploadErrorMessage, uploadFiles, validateFile } from "../api-client";
import type { Department, FileKind, Profile, Warning } from "../api-client";
import { useApi } from "../use-api";
import { pretendard } from "../fonts/pretendard";
import { WeatherIcon } from "../weather-icon";
import { ProfileForm, type ProfileChanges } from "./profile-form";
import styles from "./page.module.css";

const STARS = [[14, 12], [33, 30], [67, 10], [86, 34], [48, 22], [24, 62], [74, 56]];
const button = `${styles.cta} ${styles.tap}`;
const secondaryButton = `${button} ${styles.tint}`;
const chevron = <svg className={styles.ico} viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>;

function SkyHead({ step, title, back }: { step?: number; title: string; back: ReactNode }) {
  return (
    <div className={step ? styles.skyhead : `${styles.skyhead} ${styles.editHead}`}>
      <div className={styles.stars} aria-hidden="true">
        {STARS.map(([left, top]) => <i key={`${left}-${top}`} style={{ left: `${left}%`, top: `${top}%` }} />)}
      </div>
      <span className={styles.orb} aria-hidden="true"><WeatherIcon sky="sun" /></span>
      {back}
      <header className={styles.lt}>
        <div>
          {step && <div className={styles.sub}>{step}단계</div>}
          <h1>{title}</h1>
        </div>
      </header>
      {step && <div className={styles.prog}><i style={{ width: `${step * 50}%` }} /></div>}
    </div>
  );
}

export default function StartPage() {
  return (
    <div className={`${pretendard.variable} ${styles.page}`}>
      <main className={styles.screen}>
        <Suspense fallback={<p role="status">학적 정보를 불러오는 중…</p>}>
          <StartContent />
        </Suspense>
      </main>
    </div>
  );
}

function StartContent() {
  const account = useApi(loadAccount);
  const editing = useSearchParams().get("edit") === "1";

  if (account.data) {
    return <Onboarding
      key={String(editing)}
      initialProfile={account.data.me.profile}
      initialCompleted={account.data.me.profileCompleted}
      departments={account.data.departments}
      curriculumRules={account.data.curriculumRules}
      initialWarnings={account.data.warnings}
      reload={account.reload}
      editing={editing}
    />;
  }
  return <div className={styles.card}>
    {account.error ? <>
      <p role="alert">{account.error}</p>
      <button type="button" className={button} onClick={account.reload}>다시 시도</button>
    </> : <p role="status">학적 정보를 불러오는 중…</p>}
  </div>;
}

function Onboarding({ initialProfile, initialCompleted, departments, curriculumRules, initialWarnings, reload, editing }: {
  initialProfile: Profile | null;
  initialCompleted: boolean;
  departments: Department[];
  curriculumRules: CurriculumRule[];
  initialWarnings: Warning[];
  reload: () => void;
  editing: boolean;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [step, setStep] = useState(initialCompleted && !editing ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [warnings, setWarnings] = useState(initialWarnings);
  const [profile, setProfile] = useState(initialProfile);
  const [files, setFiles] = useState<Partial<Record<FileKind, File | null>>>({});
  const [fileErrors, setFileErrors] = useState<Partial<Record<FileKind, string>>>({});
  const [dragOverKind, setDragOverKind] = useState<FileKind | null>(null);
  const [timetableTerm, setTimetableTerm] = useState("");
  const [result, setResult] = useState<{ parsed: number; saved: number }>();
  const resultHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (result && step === 2) resultHeading.current?.focus();
  }, [result, step]);

  async function run(action: () => Promise<void>, message = errorMessage) {
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
        setError(message(failure));
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function finishProfile() {
    if (editing) router.replace("/my");
    else setStep(2);
  }

  function save(changes: ProfileChanges) {
    if (profile && Object.keys(changes).length === 0) {
      setError("");
      finishProfile();
      return;
    }
    void run(async () => {
      const response = await change<{ profile: Profile }>("users/me/profile", "PATCH", {
        expectedRevision: profile?.revision ?? 0,
        ...changes,
      });
      setProfile(response.data.profile);
      setWarnings(response.meta.warnings ?? []);
      finishProfile();
    });
  }

  function selectFile(kind: FileKind, file: File | null) {
    if (lock.current) return;
    const invalid = file ? validateFile(kind, file) : "";
    setFileErrors((state) => ({ ...state, [kind]: invalid }));
    setError("");
    setResult(undefined);
    if (!invalid) setFiles((state) => ({ ...state, [kind]: file }));
  }

  function submitFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.grades && !files.timetable) return;
    void run(async () => {
      const response = await uploadFiles(files, timetableTerm);
      setResult(response.data);
      setFiles({});
      setFileErrors({});
      setTimetableTerm("");
    }, uploadErrorMessage);
  }

  const back = step === 1
    ? <Link className={styles.back} href={editing ? "/my" : "/login"}>{chevron}{editing ? "내 정보" : "로그인"}</Link>
    : <button className={styles.back} type="button" disabled={busy} onClick={() => { setError(""); setStep(1); }}>
      {chevron}학적 정보
    </button>;

  return (
    <section className={styles.view}>
      <SkyHead step={editing ? undefined : step}
        title={editing ? "학적 정보 수정" : step === 1 ? "학과와 입학연도" : "성적 입력"} back={back} />
      {warnings.map((warning) => <p className={styles.message} key={warning.code} role="status">{warning.message}</p>)}
      {error && <p className={`${styles.message} ${styles.bad}`} role="alert">{error}</p>}
      {step === 1 ? (
        <ProfileForm
          profile={profile} departments={departments} rules={curriculumRules}
          busy={busy} stale={stale} editing={editing} onSave={save}
        />
      ) : (
        <form onSubmit={submitFiles} className={styles.stack}>
          <p className={styles.ctext}>성적표와 수강신청확인서를 각각 또는 한 번에 올릴 수 있어요. 파일당 최대 10MB입니다.</p>
          <div className={styles.uploadGrid}>
            {(Object.keys(uploadInfo) as FileKind[]).map((kind) => (
              <fieldset className={styles.card} disabled={busy} key={kind}>
                <div className={styles.field}>
                  <h2>{uploadInfo[kind].title}</h2>
                  <p className={styles.ctext}>{uploadInfo[kind].description}</p>
                  <label className={dragOverKind === kind ? `${styles.drop} ${styles.dragOver}` : styles.drop}
                    htmlFor={`start-${kind}`}
                    onDragOver={(event) => {
                      if (!event.dataTransfer.types.includes("Files")) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = busy ? "none" : "copy";
                      if (!busy && dragOverKind !== kind) setDragOverKind(kind);
                    }}
                    onDragLeave={(event) => {
                      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
                      setDragOverKind(current => current === kind ? null : current);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragOverKind(null);
                      if (lock.current) return;
                      const { files: dropped } = event.dataTransfer;
                      if (dropped.length === 1) selectFile(kind, dropped[0]);
                      else if (dropped.length > 1) {
                        setFileErrors(state => ({ ...state, [kind]: "파일을 한 개씩 선택해 주세요." }));
                      }
                    }}>
                    <input type="file" id={`start-${kind}`} accept={uploadInfo[kind].extension}
                      aria-label={`${uploadInfo[kind].title} ${files[kind] ? "다른 파일 선택" : "파일 선택"}`}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) selectFile(kind, file);
                        event.currentTarget.value = "";
                      }} />
                    <span className={styles.ic} aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M12 16V4m-6 6 6-6 6 6M4 20h16" /></svg>
                    </span>
                    <b>{dragOverKind === kind ? "여기에 파일을 놓으세요" : files[kind] ? "다른 파일 선택" : "파일 선택"}</b>
                    <span className={styles.hint}>클릭하거나 파일을 끌어다 놓으세요 · {uploadInfo[kind].extension.toUpperCase()} · 최대 10MB</span>
                  </label>
                  {fileErrors[kind] && <p className={styles.bad} role="alert">{fileErrors[kind]}</p>}
                  {files[kind] && <div className={styles.selectedFile}>
                    <span>{files[kind]?.name}</span>
                    <button type="button" className={styles.textButton} onClick={() => selectFile(kind, null)}>선택 취소</button>
                  </div>}
                  {kind === "timetable" && files.timetable && (
                    <TimetableTermSelect value={timetableTerm} onChange={setTimetableTerm} disabled={busy} />
                  )}
                  <details className={styles.guide}>
                    <summary>파일 다운로드 방법</summary>
                    <ol className={styles.steps}>{uploadInfo[kind].guide.map((item) => <li key={item}>{item}</li>)}</ol>
                    <a href="https://portal.uos.ac.kr" target="_blank" rel="noopener">서울시립대 포털 열기</a>
                  </details>
                </div>
              </fieldset>
            ))}
          </div>
          {!result && <button className={button} type="submit" disabled={busy || (!files.grades && !files.timetable)}>
            {busy ? "업로드 중…" : "파일 업로드"}
          </button>}
          {result ? (
            <section className={`${styles.card} ${styles.uploadResult}`} aria-labelledby="upload-result">
              <h2 id="upload-result" ref={resultHeading} tabIndex={-1}>파일 업로드 완료</h2>
              <p role="status">{result.parsed}과목을 읽고 {result.saved}건을 저장했습니다.</p>
              <div className={styles.resultActions}>
                <Link href="/grades" className={`${button} ${styles.outline}`}>성적 확인</Link>
                <Link href="/" className={button}>시작하기</Link>
              </div>
            </section>
          ) : !busy && <Link href="/" className={secondaryButton}>나중에 입력하고 시작하기</Link>}
        </form>
      )}
      {stale && <div className={styles.stack}>
        <p className={styles.hint}>다시 불러오면 저장하지 않은 입력이 사라져요.</p>
        <button className={button} type="button" onClick={reload}>최신 학적 정보 불러오기</button>
      </div>}
    </section>
  );
}
