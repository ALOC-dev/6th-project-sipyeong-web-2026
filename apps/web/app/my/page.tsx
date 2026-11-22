"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme-provider";
import styles from "./page.module.css";

// 화면 문구가 바뀌어도 파일 종류를 식별하는 내부 값은 유지한다.
// grades는 성적 Excel, timetable은 수강신청확인서 PDF를 뜻한다.
type FileKind = "grades" | "timetable";
// 두 파일을 별도 항목으로 보관해 한쪽을 변경해도 다른 파일은 유지한다.
type SelectedFiles = Record<FileKind, File | null>;

// 현재는 예시 제한이다. API 연결 시 백엔드의 허용 용량과 맞춘다.
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 같은 SVG 컴포넌트에 경로만 전달해 메뉴와 파일 아이콘을 재사용한다.
const iconPaths = {
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  checklist: "m3 6 1 1 2-2M9 6h12M3 12l1 1 2-2M9 12h12M3 18l1 1 2-2M9 18h12",
  award: "M8 14 6 22l6-3 6 3-2-8M17 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  road: "M5 3v5c0 5 14 3 14 8v5M2 3h6M16 21h6M12 7v2M12 13v2",
  chart: "M4 20h17M7 16v-5M12 16V5M17 16V8",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21v-2a7 7 0 0 1 14 0v2",
  file: "M14 3H6v18h12V7l-4-4ZM14 3v5h4",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
};

type IconName = keyof typeof iconPaths;

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

// 구현된 홈과 내 정보만 링크로 연결하고, 나머지 메뉴는 비활성화한다.
const navigation: { label: string; icon: IconName; href?: string }[] = [
  { label: "홈", icon: "home", href: "/" },
  { label: "졸업요건", icon: "checklist" },
  { label: "디그리", icon: "award" },
  { label: "로드맵", icon: "road" },
  { label: "학점", icon: "chart" },
  { label: "내 정보", icon: "user", href: "/my" },
];

// 파일 종류별 문구·허용 확장자·다운로드 안내를 한곳에서 관리한다.
// 팝업은 선택된 종류의 설정만 읽으므로 Excel과 PDF가 함께 표시되지 않는다.
const uploadInfo = {
  grades: {
    title: "성적 Excel",
    dialogTitle: "성적 파일 업데이트",
    description: "전체성적조회에서 내려받은 성적 Excel 파일을 선택해주세요.",
    extension: ".xlsx",
    guide: ["대학행정 접속", "수업/성적 → 성적표조회", "전체성적조회 선택", "Excel 다운로드"],
  },
  timetable: {
    title: "수강신청확인서 PDF",
    dialogTitle: "수강신청확인서 PDF 등록",
    description: "이번 학기 수강신청확인서 PDF 파일을 선택해주세요.",
    extension: ".pdf",
    guide: ["대학행정 접속", "수강 → 수강신청확인서", "이번 학기 수강 내역 확인", "PDF 다운로드"],
  },
};

// 파일 선택 화면은 하나만 만들고 kind로 Excel/PDF 검사 기준을 바꾼다.
// file은 부모가 보관하고, onSelect로 선택·취소 결과를 부모에게 전달한다.
function UploadPanel({
  kind,
  file,
  onSelect,
}: {
  kind: FileKind;
  file: File | null;
  onSelect: (file: File | null) => void;
}) {
  // 커스텀 버튼을 눌렀을 때 숨겨진 기본 파일 선택 창을 열기 위한 참조다.
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const info = uploadInfo[kind];

  // 파일 선택 버튼과 끌어놓기가 같은 검사 함수를 사용한다.
  // 여기서는 사용자 안내용 사전 검사만 하며 서버에서도 다시 검증해야 한다.
  function selectFile(nextFile: File | undefined) {
    if (!nextFile) return;
    setError("");

    if (!nextFile.name.toLowerCase().endsWith(info.extension)) {
      setError(`${info.extension} 형식의 파일을 선택해주세요.`);
      return;
    }
    if (nextFile.size === 0) {
      setError("내용이 없는 파일이에요. 다시 확인해주세요.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError("10MB 이하의 파일을 선택해주세요.");
      return;
    }
    // 검사를 통과한 파일만 부모 상태에 반영한다. 실제 서버 전송은 아직 없다.
    onSelect(nextFile);
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
          <button type="button" className={styles.textButton} onClick={() => { onSelect(null); setError(""); }}>
            선택 취소
          </button>
        </div>
      )}
    </section>
  );
}

export default function MyPage() {
  const router = useRouter();

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
    // 버튼에서 전달한 종류 하나만 활성화한다.
    setActiveUpload(kind);
  }

  function updateSelectedFile(kind: FileKind, file: File | null) {
    // 기존 파일 상태를 복사하고 선택한 종류의 파일만 갱신한다.
    setFiles((previous) => ({ ...previous, [kind]: file }));
  }

  function closeUploadDialog() {
    // 닫기 버튼과 X 버튼이 같은 종료 동작을 사용한다.
    // 실제 상태 초기화는 dialog의 onClose에서 처리해 Esc 종료도 지원한다.
    uploadDialogRef.current?.close();
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError("");

    try {
      // 인증 브랜치의 API는 쿠키 세션 방식이다.
      // /api 요청이 NestJS로 전달되도록 연결한 환경에서 실행해야 한다.
      const sessionResponse = await fetch("/api/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
      });

      // 이미 만료된 세션이라면 종료 요청 없이 로그인 화면으로 이동한다.
      if (sessionResponse.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      if (!sessionResponse.ok) {
        throw new Error("Session lookup failed");
      }

      // 로그아웃은 변경 요청이므로 서버가 발급한 CSRF 토큰을 함께 보낸다.
      // 쿠키 자체는 httpOnly라 FE에서 직접 읽거나 지우지 않는다.
      const session: { data?: { csrfToken?: unknown } } =
        await sessionResponse.json();
      const csrfToken = session.data?.csrfToken;

      if (typeof csrfToken !== "string" || !csrfToken) {
        throw new Error("Missing CSRF token");
      }

      const logoutResponse = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": csrfToken },
      });

      // 정상 응답은 204다. 두 요청 사이에 세션이 만료된 401도 로그아웃 상태다.
      if (logoutResponse.status !== 204 && logoutResponse.status !== 401) {
        throw new Error("Logout failed");
      }

      // 로그인 화면 경로는 인증 API의 리다이렉트 경로와 같은 /login 기준이다.
      // 용준님 로그인 화면을 이 경로로 연결한 뒤 실제 이동을 확인한다.
      router.replace("/login");
      router.refresh();
    } catch {
      // API 연결 전의 404나 서버 오류를 성공으로 처리하지 않고 안내한다.
      setLogoutError("로그아웃하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  // Figma 확인용 예시 데이터. 실제 사용자 및 업로드 결과 API로 교체할 부분.
  const profile = {
    department: "컴퓨터과학부",
    admissionYear: "2024학번",
    curriculumYear: "2024학년도",
    engineering: "공학인증 대상",
  };
  const savedGrade = {
    name: "성적조회_2026-1.xlsx",
    appliedAt: "10.31",
    courseCount: 27,
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{savedGrade.appliedAt} 성적표 반영</p>
        <h1>내 정보</h1>
        <svg className={styles.sun} viewBox="0 0 32 32" fill="none" stroke="#FFD15C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="16" cy="16" r="6" fill="#FFD15C" />
          <path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M6 26l3-3M23 9l3-3" />
        </svg>
        <div className={styles.profileLine}>
          <div>
            <h2>{profile.department}</h2>
            <p>{profile.admissionYear}, {profile.curriculumYear} 교육과정, {profile.engineering}</p>
          </div>
          {/* 기본정보 변경 화면은 팀의 공통 화면 경로 확정 후 연결 */}
          <button type="button" className={styles.changeButton} disabled>변경</button>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.fileColumn} aria-label="학업 자료">
          <div className={styles.fileCard}>
            <span className={styles.fileIcon}><Icon name="file" /></span>
            <div className={styles.fileText}>
              <h2 title={files.grades?.name ?? savedGrade.name}>{files.grades?.name ?? savedGrade.name}</h2>
              <p>{files.grades ? "새 파일 선택됨 · 전송 대기" : `${savedGrade.appliedAt} 업로드, ${savedGrade.courseCount}과목`}</p>
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
        </section>

        <section className={styles.settings} aria-label="내 정보 설정">
          {/* 실제 디그리 화면과 기준 데이터 기능은 해당 기능 구현 후 연결 */}
          <button type="button" className={styles.settingRow} disabled>
            <strong>마이크로디그리</strong>
            <span className={styles.settingValue}>1개 신청 가능 <span aria-hidden="true">›</span></span>
          </button>
          <div className={styles.settingRow}>
            <strong>기준 데이터</strong>
            <span className={styles.settingValue}>{profile.curriculumYear}</span>
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
            <span className={styles.settingValue}>이 기기</span>
          </div>
        </section>

        {/* 흰색 설정 section 밖에 배치해 페이지 배경 위에 표시한다.
            logoutArea가 PC의 두 열 전체를 사용하므로 화면 가운데에 정렬된다. */}
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
      </div>

      <nav className={styles.bottomNav} aria-label="주 메뉴">
        {navigation.map((item) => item.href ? (
          <Link key={item.label} href={item.href} className={item.href === "/my" ? styles.activeNav : undefined} aria-current={item.href === "/my" ? "page" : undefined}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </Link>
        ) : (
          <button key={item.label} type="button" disabled><Icon name={item.icon} /><span>{item.label}</span></button>
        ))}
      </nav>

      {/* native dialog는 배경 클릭 방지, 팝업 안 포커스 이동, Esc 종료를 지원한다. */}
      <dialog
        ref={uploadDialogRef}
        className={styles.uploadDialog}
        aria-labelledby="upload-dialog-title"
        onClose={() => setActiveUpload(null)}
      >
        <div className={styles.dialogHeading}>
          <h2 id="upload-dialog-title">{activeInfo?.dialogTitle ?? "파일 업데이트"}</h2>
          <button type="button" className={styles.closeButton} aria-label="파일 선택 창 닫기" onClick={closeUploadDialog}>×</button>
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
              onSelect={(file) => updateSelectedFile(activeUpload, file)}
            />
          )}
        </div>
        <p className={styles.dialogNote}>선택한 파일은 아직 저장되지 않았으며, 새로고침하면 초기화돼요.</p>
        <div className={styles.dialogFooter}>
          <button type="button" className={styles.primaryButton} onClick={closeUploadDialog}>닫기</button>
        </div>
      </dialog>
    </main>
  );
}
