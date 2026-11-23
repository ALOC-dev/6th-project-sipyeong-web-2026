"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../academic-nav";
import { loadAccount } from "../academic-account";
import { TimetableTermSelect, uploadInfo } from "../academic-upload";
import { change, errorMessage, requiresLogin, uploadErrorMessage, uploadFiles, validateFile, type FileKind } from "../api-client";
import { useApi } from "../use-api";
import { useTheme } from "../theme-provider";
import styles from "./page.module.css";

type SelectedFiles = Record<FileKind, File | null>;

// 파일 선택 화면은 하나만 만들고 kind로 Excel/PDF 검사 기준을 바꾼다.
// file은 부모가 보관하고, onSelect로 선택·취소 결과를 부모에게 전달한다.
function UploadPanel({
  kind,
  file,
  onSelect,
  disabled,
}: {
  kind: FileKind;
  file: File | null;
  onSelect: (file: File | null) => void;
  disabled: boolean;
}) {
  // 커스텀 버튼을 눌렀을 때 숨겨진 기본 파일 선택 창을 열기 위한 참조다.
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const info = uploadInfo[kind];

  // 파일 선택 버튼과 끌어놓기가 같은 검사 함수를 사용한다.
  // 여기서는 사용자 안내용 사전 검사만 하며 서버에서도 다시 검증해야 한다.
  function selectFile(nextFile: File | undefined) {
    if (disabled || !nextFile) return;
    const problem = validateFile(kind, nextFile);
    setError(problem);
    onSelect(problem ? null : nextFile);
  }

  return (
    <section className={styles.uploadPanel}>
      <h3>{info.title}</h3>
      <details className={styles.guide}>
        <summary>파일 다운로드 방법</summary>
        <ol>{info.guide.map((step) => <li key={step}>{step}</li>)}</ol>
      </details>

      <input
        ref={inputRef}
        type="file"
        accept={info.extension}
        hidden
        disabled={disabled}
        aria-label={`${info.title} 파일 선택`}
        onChange={(event) => {
          selectFile(event.currentTarget.files?.[0]);
          // 동일한 파일을 다시 선택해도 change 이벤트가 발생하도록 초기화한다.
          event.currentTarget.value = "";
        }}
      />

      <div
        className={styles.dropZone}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          // 파일을 브라우저에서 직접 여는 기본 동작을 막는다.
          event.preventDefault();
          if (disabled) return;
          if (event.dataTransfer.files.length !== 1) {
            setError("파일을 한 개씩 선택해주세요.");
            return;
          }
          selectFile(event.dataTransfer.files[0]);
        }}
      >
        <Icon name="upload" />
        <p>파일을 여기에 놓아주세요</p>
        <span className={styles.muted}>{info.extension} · 최대 10MB</span>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={disabled}
          aria-describedby={error ? `${kind}-error` : undefined}
          onClick={() => inputRef.current?.click()}
        >
          {file ? "다른 파일 선택" : "파일 선택"}
        </button>
      </div>

      {error && <p id={`${kind}-error`} className={styles.error} role="alert">{error}</p>}

      {file && (
        <div className={styles.selectedFile} aria-live="polite">
          <div>
            <strong>{file.name}</strong>
            <span className={styles.muted}>선택됨 · {(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <button type="button" className={styles.textButton} disabled={disabled} onClick={() => { onSelect(null); setError(""); }}>
            선택 취소
          </button>
        </div>
      )}
    </section>
  );
}

export default function MyPage() {
  const router = useRouter();
  const account = useApi(loadAccount);
  const uploadLock = useRef(false);
  const logoutLock = useRef(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState("");
  const [timetableTerm, setTimetableTerm] = useState("");

  // 중복 요청을 막고, 실패했을 때 현재 화면에서 다시 시도할 수 있도록 관리한다.
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  // dialog 요소의 showModal/close 메서드를 호출하기 위한 참조다.
  const uploadDialogRef = useRef<HTMLDialogElement>(null);

  // 페이지 안의 독립 상태 대신 공통 테마를 읽는다.
  // 여기서 바꾸면 html의 색상 변수도 바뀌어 홈 화면까지 같은 테마가 적용된다.
  const { theme, setTheme } = useTheme();

  // 실제 File 객체는 부모에 보관하므로 팝업을 닫거나 종류를 바꿔도 유지된다.
  const [files, setFiles] = useState<SelectedFiles>({ grades: null, timetable: null });

  // null: 팝업 닫힘 / grades: 성적만 표시 / timetable: 수강신청확인서만 표시.
  const [activeUpload, setActiveUpload] = useState<FileKind | null>(null);
  const activeInfo = activeUpload ? uploadInfo[activeUpload] : null;

  useEffect(() => {
    // React가 선택한 파일 종류의 화면을 그린 다음 팝업을 연다.
    // 이렇게 해야 이전 종류의 화면이 잠깐 보이거나 포커스가 어긋나지 않는다.
    const dialog = uploadDialogRef.current;
    if (activeUpload && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [activeUpload]);

  function openUploadDialog(kind: FileKind) {
    setUploadError("");
    setActiveUpload(kind);
  }

  function updateSelectedFile(kind: FileKind, file: File | null) {
    // 기존 파일 상태를 복사하고 선택한 종류의 파일만 갱신한다.
    setFiles((previous) => ({ ...previous, [kind]: file }));
  }

  function closeUploadDialog() {
    // 닫기 버튼과 X 버튼이 같은 종료 동작을 사용한다.
    // 실제 상태 초기화는 dialog의 onClose에서 처리해 Esc 종료도 지원한다.
    if (!uploadLock.current) uploadDialogRef.current?.close();
  }

  async function handleLogout() {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      await change("auth/logout", "POST");
      router.replace("/login");
    } catch (error) {
      if (requiresLogin(error)) router.replace("/login?reason=session");
      else setLogoutError(errorMessage(error));
    } finally {
      logoutLock.current = false;
      setIsLoggingOut(false);
    }
  }

  async function submitUpload() {
    const file = activeUpload && files[activeUpload];
    if (!activeUpload || !file || uploadLock.current) return;
    uploadLock.current = true;
    setUploadBusy(true);
    setUploadError("");
    setUploadResult("");
    try {
      const { data } = await uploadFiles({ [activeUpload]: file }, timetableTerm);
      updateSelectedFile(activeUpload, null);
      if (activeUpload === "timetable") setTimetableTerm("");
      setUploadResult(`${data.parsed}과목을 읽고 ${data.saved}건을 저장했습니다.`);
      uploadDialogRef.current?.close();
    } catch (error) {
      if (requiresLogin(error)) router.replace("/login?reason=session");
      else setUploadError(uploadErrorMessage(error));
    } finally {
      uploadLock.current = false;
      setUploadBusy(false);
    }
  }

  if (!account.data) {
    return <main className={styles.page}>
      <h1>내 정보</h1>
      {account.error ? <><p role="alert">{account.error}</p><button type="button" onClick={account.reload}>다시 시도</button></>
        : <p role="status">학적 정보를 불러오는 중…</p>}
    </main>;
  }
  const { me, departments, warnings } = account.data;
  const profile = me.profile;
  const department = departments.find((item) => item.departmentId === profile?.departmentId);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>내 정보</h1>
        <svg className={styles.sun} viewBox="0 0 32 32" fill="none" stroke="#FFD15C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="16" cy="16" r="6" fill="#FFD15C" />
          <path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M6 26l3-3M23 9l3-3" />
        </svg>
        <div className={styles.profileLine}>
          <div>
            <h2>{department?.name ?? "학적 정보"}</h2>
            {profile && <>
              <p>{profile.admissionYear}학번 · {profile.curriculumYear ? `${profile.curriculumYear}학년도 교육과정` : "교육과정 미등록"}</p>
              <p>봉사시간 {profile.volunteerHours === null ? "미등록" : `${profile.volunteerHours}시간`}</p>
              {profile.languageScores.map((score, index) => (
                <p key={index}>{score.examType} {[score.score, score.grade].filter((value) => value !== null).join(" · ")}</p>
              ))}
            </>}
          </div>
          <Link href="/start?edit=1" className={styles.changeButton}>
            {me.profileCompleted ? "학적 정보 수정" : "학적 정보 입력"}
          </Link>
        </div>
      </header>

      <div className={styles.content}>
        {warnings.map((warning) => <p key={warning.code} role="status">{warning.message}</p>)}
        <section id="academic-files" className={styles.fileColumn} aria-label="학업 자료">
          <div className={styles.fileCard}>
            <span className={styles.fileIcon}><Icon name="file" /></span>
            <div className={styles.fileText}>
              <h2>성적 Excel</h2>
              <p>{files.grades ? "새 파일 선택됨 · 전송 대기" : "전체성적조회 XLSX"}</p>
            </div>
            {/* 성적 버튼은 grades를 전달해 성적 Excel 패널만 연다. */}
            <button type="button" className={styles.updateButton} onClick={() => openUploadDialog("grades")}>
              업데이트
            </button>
          </div>

          <div className={styles.fileCard}>
            <span className={styles.fileIcon}><Icon name="file" /></span>
            <div className={styles.fileText}>
              <h2 title={files.timetable?.name ?? "수강신청확인서 PDF"}>{files.timetable?.name ?? "수강신청확인서 PDF"}</h2>
              <p>{files.timetable ? "새 파일 선택됨 · 전송 대기" : "이번 학기 수강신청확인서"}</p>
            </div>
            {/* PDF 버튼은 timetable을 전달해 수강신청확인서 패널만 연다. */}
            <button type="button" className={styles.updateButton} onClick={() => openUploadDialog("timetable")}>
              {files.timetable ? "변경" : "등록"}
            </button>
          </div>
          {uploadResult && <p role="status">{uploadResult} <Link href="/grades">성적 조회 ›</Link></p>}
        </section>

        <section className={styles.settings} aria-label="내 정보 설정">
          {/* 실제 디그리 화면과 기준 데이터 기능은 해당 기능 구현 후 연결 */}
          <button type="button" className={styles.settingRow} disabled>
            <strong>마이크로디그리</strong>
            <span className={styles.settingValue}>준비 중</span>
          </button>
          <div className={styles.settingRow}>
            <strong>기준 데이터</strong>
            <span className={styles.settingValue}>{profile?.curriculumYear ?? "미등록"}</span>
          </div>
          <div className={styles.settingRow}>
            <strong>화면 테마</strong>
            <div className={styles.themeGroup} role="group" aria-label="화면 테마">
              {/* 서비스 전체에서 라이트·다크 두 가지만 선택할 수 있다. */}
              {([{ value: "light", label: "라이트" }, { value: "dark", label: "다크" }] as const).map((item) => (
                <button key={item.value} type="button" aria-pressed={theme === item.value} onClick={() => setTheme(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.settingRow}>
            <strong>저장 위치</strong>
            <span className={styles.settingValue}>시평 서버</span>
          </div>
          <div className={styles.logoutArea}>
            <button
              type="button"
              className={styles.logoutButton}
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-busy={isLoggingOut}
              aria-describedby={logoutError ? "logout-error" : undefined}
            >
              {isLoggingOut ? "로그아웃 중…" : "로그아웃"}
            </button>
            {logoutError && (
              <p id="logout-error" className={styles.logoutError} role="alert">
                {logoutError}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* native dialog는 배경 클릭 방지, 팝업 안 포커스 이동, Esc 종료를 지원한다. */}
      <dialog
        ref={uploadDialogRef}
        className={styles.uploadDialog}
        aria-labelledby="upload-dialog-title"
        onClose={() => setActiveUpload(null)}
        onCancel={(event) => { if (uploadLock.current) event.preventDefault(); }}
      >
        <div className={styles.dialogHeading}>
          <h2 id="upload-dialog-title">{activeInfo?.dialogTitle ?? "파일 업데이트"}</h2>
          <button type="button" className={styles.closeButton} aria-label="파일 선택 창 닫기" disabled={uploadBusy} onClick={closeUploadDialog}>×</button>
        </div>
        <p className={styles.dialogDescription}>{activeInfo?.description}</p>
        <div className={styles.uploadGrid}>
          {/* 선택된 종류의 패널 하나만 렌더링한다.
              key로 종류가 바뀌면 검사 오류와 안내 펼침 상태도 새로 시작한다.
              선택한 파일 자체는 부모의 files에 남아 있다. */}
          {activeUpload && (
            <UploadPanel
              key={activeUpload}
              kind={activeUpload}
              file={files[activeUpload]}
              disabled={uploadBusy}
              onSelect={(file) => { setUploadError(""); updateSelectedFile(activeUpload, file); }}
            />
          )}
        </div>
        {activeUpload === "timetable" && files.timetable && (
          <TimetableTermSelect value={timetableTerm} onChange={setTimetableTerm} disabled={uploadBusy} />
        )}
        {uploadError && <p className={styles.error} role="alert">{uploadError}</p>}
        <div className={styles.dialogFooter}>
          <button type="button" className={styles.primaryButton} disabled={uploadBusy || !activeUpload || !files[activeUpload]}
            onClick={submitUpload}>{uploadBusy ? "업로드 중…" : "업로드"}</button>
        </div>
      </dialog>
    </main>
  );
}
