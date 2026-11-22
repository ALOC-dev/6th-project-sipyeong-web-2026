"use client";

import Link from "next/link";
import { useRef } from "react";
import { getProfileGraduationDates, formatGraduationDate, useGraduationProgress } from "./graduation-progress";
import { GraduationProgressDialog } from "./graduation-progress-dialog";
import styles from "./page.module.css";
import { useStudentProfile } from "./profile-provider";
import { getEngineeringStatus, getRemainingSemesterCount, formatGraduationPeriod } from "./profile-model";
import { useGradePlan } from "./grade-plan-provider";
import { buildSemesterWeather, getWeatherType, WeatherIcon } from "./grade-weather";
import { SemesterGpaDialog } from "./semester-gpa-dialog";

// 홈과 학점·도움말이 공통 날씨 판정과 아이콘을 사용한다.

/* 메뉴 아이콘 */
const iconPaths = {
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  checklist:
    "m3 6 1 1 2-2M9 6h12M3 12l1 1 2-2M9 12h12M3 18l1 1 2-2M9 18h12",
  award:
    "M8 14 6 22l6-3 6 3-2-8M17 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  road:
    "M5 3v5c0 5 14 3 14 8v5M2 3h6M16 21h6M12 7v2M12 13v2",
  chart: "M4 20h17M7 16v-5M12 16V5M17 16V8",
  user:
    "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21v-2a7 7 0 0 1 14 0v2",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
  external: "M14 3h7v7m0-7L11 13M10 5H4v15h15v-6",
};

type IconName = keyof typeof iconPaths;

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

/* 도움말 표시 */
function InfoMark({ text, onClick }: { text: string; onClick?: () => void }) {
  // 졸업 진행률 도움말은 실제 버튼으로 제공하고 기존의 다른 안내는 유지한다.
  if (onClick) return (
    <button type="button" className={`${styles.infoMark} ${styles.infoMarkButton}`}
      aria-label={text} aria-haspopup="dialog" onClick={onClick}>?</button>
  );
  return (
    <span
      className={styles.infoMark}
      title={text}
      aria-label={text}
    >
      ?
    </span>
  );
}

// 성적·수강학점·예상 평점은 공유 데이터에서 읽는다.
const requirements = [
  {
    label: "총 이수학점",
    value: "54학점",
    progress: 58,
    planned: 74,
  },
  {
    label: "전공필수",
    value: "12학점",
    progress: 56,
    planned: 78,
    note: "미이수 운영체제, 캡스톤디자인",
  },
  {
    label: "전공선택",
    value: "12학점",
    progress: 70,
    planned: 94,
  },
  {
    label: "교양선택",
    value: "충족 예정",
    progress: 82,
    planned: 100,
    expected: true,
  },
  {
    label: "공학소양",
    value: "3학점",
    progress: 0,
    planned: 0,
  },
];

const recommendations = [
  {
    name: "운영체제",
    category: "전공필수 3학점",
    description: "전공필수 6학점 미이수",
    caution: "졸업 전 마지막 개설, 권장 학기 지남",
  },
  {
    name: "데이터마이닝",
    category: "전공선택 3학점",
    description: "4학년 1학기 권장, 빅데이터 초급 인증 과목",
    caution: "졸업 전 마지막 개설",
  },
  {
    name: "기계학습",
    category: "전공선택 3학점",
    description: "4학년 1학기 권장, 이수 시 머신러닝 입문 취득",
    caution: "",
  },
];

const shortcuts: { label: string; icon: IconName }[] = [
  { label: "성적표", icon: "upload" },
  { label: "학점 계산", icon: "chart" },
  { label: "디그리 신청", icon: "award" },
  { label: "포털", icon: "external" },
];

const navigation: { label: string; icon: IconName }[] = [
  { label: "홈", icon: "home" },
  { label: "졸업요건", icon: "checklist" },
  { label: "디그리", icon: "award" },
  { label: "로드맵", icon: "road" },
  { label: "학점", icon: "chart" },
  { label: "내 정보", icon: "user" },
];

/* 메인 화면 */
export default function Home() {
  const progressDialogRef = useRef<HTMLDialogElement>(null);
  const { profile } = useStudentProfile();
  const { data, previous, previousMajor, currentCredits, target, plan, forecast } = useGradePlan();
  const semesterDialogRef = useRef<HTMLDialogElement>(null);
  const dates = getProfileGraduationDates(profile);
  const semesters = buildSemesterWeather({
    history: data.history, currentSemester: data.currentSemester,
    admissionYear: profile.admissionYear, graduationYear: profile.graduationYear, graduationMonth: profile.graduationMonth,
    currentTarget: data.currentCourses.length ? target : null,
    remainingSemesterAverage: data.remainingSemesterAverage,
  });
  const formatGpa = (value: number | null) => value === null ? "—" : value.toFixed(2);
  const summaryItems = [
    { label: "평점", description: `전공 ${formatGpa(previousMajor.gpa)}`, value: formatGpa(previous.gpa) },
    { label: "인정 학점", description: `취득 ${previous.earnedCredits}학점`, value: `${previous.earnedCredits}학점` },
    { label: "이번 학기", description: `${data.currentCourses.length}과목, 12.19 종강`, value: `${currentCredits}학점` },
    { label: "남은 학기", description: `${formatGraduationPeriod(profile)} 졸업 예정`, value: `${getRemainingSemesterCount(data.currentSemester, profile.graduationYear, profile.graduationMonth)}학기` },
  ];
  // 현재 예시 성적에서 공학소양으로 분류된 유효 이수 과목만 집계한다.
  // API 연결 후에는 이 목록도 업로드 결과로 교체한다.
  const engineering = getEngineeringStatus(profile, data.history.flatMap((semester) => semester.courses));
  const displayedRequirements = requirements
    .filter((item) => item.label !== "공학소양" || engineering.required > 0)
    .map((item) => item.label === "공학소양" ? {
      ...item,
      value: engineering.remaining ? `${engineering.remaining}학점` : "충족",
      progress: engineering.progress,
      planned: engineering.progress,
      expected: false,
    } : item);

  // 고정 예시값 대신 같은 일정에서 %·해 위치·D-day를 함께 계산한다.
  const progress = useGraduationProgress(dates);
  const graduationProgress = progress?.percentage ?? 0;
  const position = graduationProgress / 100;

  const sunX = 12 + 336 * position;
  const sunY = 80 - 176 * position * (1 - position);

  return (
    <main className={styles.page}>
      {/* 졸업 현황 */}
      <header className={styles.hero}>
        <div className={styles.headingRow}>
          <div>
            <p className={styles.student}>
              컴퓨터과학부 3학년 2학기
            </p>
            <h1 className={styles.title}>졸업 현황</h1>
          </div>

          <InfoMark text="졸업 진행률 산정 기준 보기" onClick={() => progressDialogRef.current?.showModal()} />
        </div>

        <p className={styles.percentage}>
          {progress ? graduationProgress.toFixed(2) : "—"}
          <span>%</span>
        </p>

        <p className={styles.certification}>
          외국어 인증, 사회봉사 미완료
          <span aria-hidden="true">›</span>
        </p>

        {/* 졸업 진행 곡선 */}
        <svg
          className={styles.graduationCurve}
          viewBox="0 0 360 88"
          role="img"
          aria-label={progress ? `졸업까지의 기간 진행률 ${graduationProgress.toFixed(2)}%` : "졸업 진행률 계산 중"}
        >
          <path
            d="M12 80H348"
            stroke="white"
            strokeOpacity=".35"
          />

          <path
            d="M12 80Q180 -8 348 80"
            stroke="white"
            strokeOpacity=".45"
            strokeWidth="2"
            fill="none"
          />

          <path
            d={`M12 80Q${12 + 168 * position} ${
              80 - 88 * position
            } ${sunX} ${sunY}`}
            stroke="white"
            strokeWidth="2"
            fill="none"
          />

          <g
            transform={`translate(${sunX}, ${sunY})`}
            stroke="#FFD15C"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle r="5" fill="#FFD15C" />
            <path d="M0-12v3M0 9v3M-12 0h3M9 0h3" />
            <path d="m-8-8 2 2m12 12 2 2M-8 8l2-2M6-6l2-2" />
          </g>
        </svg>

        <div className={styles.dateRow}>
          <span>입학 {formatGraduationDate(dates.admission)}</span>
          <strong>{progress === null ? "졸업 일정 계산 중" : progress.remainingDays > 0
            ? `졸업 D-${progress.remainingDays}` : progress.remainingDays === 0
              ? "졸업 D-day" : `졸업 D+${Math.abs(progress.remainingDays)}`}</strong>
        </div>

        {/* 학기별 날씨 */}
        <section className={styles.semesterSection}>
          <div className={styles.sectionHeading}>
            <h2>학기별 평점</h2>

            <InfoMark text="학기별 평점 날씨 기준 보기" onClick={() => semesterDialogRef.current?.showModal()} />
          </div>

          <div className={styles.semesterGrid}>
            {semesters.map((semester) => (
              <div
                key={semester.id}
                className={`${styles.semester} ${
                  semester.current ? styles.currentSemester : ""
                }`}
                title={
                  semester.gpa === null
                    ? "성적 미확정"
                    : `${semester.basis} ${semester.gpa.toFixed(2)}`
                }
              >
                <span>{semester.label}</span>
                <WeatherIcon type={getWeatherType(semester.gpa)} tone="hero" />
              </div>
            ))}
          </div>
        </section>

        {/* 학기·학년 진행률 */}
        <section className={styles.periodGrid}>
          <div>
            <div className={styles.periodHeading}>
              <strong>이번 학기</strong>
              <span>63.10%</span>
            </div>

            <div className={styles.periodTrack}>
              <span style={{ width: "63.1%" }} />
            </div>

            <p>12.19 종강</p>
          </div>

          <div>
            <div className={styles.periodHeading}>
              <strong>3학년</strong>
              <span>69.17%</span>
            </div>

            <div className={styles.periodTrack}>
              <span style={{ width: "69.17%" }} />
            </div>

            <p>2.28까지</p>
          </div>
        </section>

        {/* 바로가기: 화면 연결 전 */}
        <div className={styles.shortcuts}>
          {shortcuts.map((shortcut) => (
            <button key={shortcut.label} type="button" disabled>
              <Icon name={shortcut.icon} />
              <span>{shortcut.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* 본문 */}
      <div className={styles.content}>
        {/* 요약 카드 */}
        <section
          className={`${styles.card} ${styles.summaryCard}`}
        >
          <div className={styles.cardHeading}>
            <h2>
              요약{" "}
              <InfoMark text="현재 성적과 학적 정보의 요약입니다." />
            </h2>
          </div>

          <dl className={styles.summaryList}>
            {summaryItems.map((item) => (
              <div key={item.label} className={styles.summaryRow}>
                <dt>
                  <span className={styles.summaryLabel}>
                    {item.label}
                  </span>
                  <span className={styles.description}>
                    {item.description}
                  </span>
                </dt>

                <dd>
                  <strong>{item.value}</strong>
                  <span className={styles.chevron} aria-hidden="true">
                    ›
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 남은 졸업요건 카드 */}
        <section
          className={`${styles.card} ${styles.requirementsCard}`}
        >
          <div className={styles.cardHeading}>
            <h2>
              남은 졸업요건{" "}
              <InfoMark text="이번 학기 수강 내역을 포함한 예시입니다." />
            </h2>
            <span className={styles.cardMore}>전체 ›</span>
          </div>

          {displayedRequirements.map((item) => (
            <div key={item.label} className={styles.requirement}>
              <div className={styles.requirementRow}>
                <span>{item.label}</span>

                <div className={styles.requirementTrack}>
                  <span
                    className={styles.plannedFill}
                    style={{ width: `${item.planned}%` }}
                  />
                  <span
                    className={styles.earnedFill}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>

                <strong
                  className={item.expected ? styles.blueText : undefined}
                >
                  {item.value}
                </strong>

                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </div>

              {item.note && (
                <p className={styles.warning}>{item.note}</p>
              )}
            </div>
          ))}
        </section>

        {/* 마이크로디그리 카드 */}
        <section
          className={`${styles.card} ${styles.degreeCard}`}
        >
          <div>
            <h2>빅데이터 초급 신청 가능</h2>
            <p className={styles.description}>2027.02까지 신청</p>
          </div>

          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </section>

        {/* 추천 과목 카드 */}
        <section
          className={`${styles.card} ${styles.recommendationsCard}`}
        >
          <div className={styles.cardHeading}>
            <h2>
              2027-1 추천 과목{" "}
              <InfoMark text="이수 내역을 기준으로 추천하는 과목입니다." />
            </h2>
            <span className={styles.cardMore}>전체 ›</span>
          </div>

          {recommendations.map((course) => (
            <article key={course.name} className={styles.course}>
              <h3>{course.name}</h3>

              <p className={styles.description}>
                {course.category}
              </p>

              <p className={styles.courseReason}>
                {course.description}
              </p>

              {course.caution && (
                <p className={styles.warning}>
                  {course.caution}
                </p>
              )}
            </article>
          ))}
        </section>

        {/* 누적 평점 카드 */}
        <section
          className={`${styles.card} ${styles.gpaCard}`}
        >
          <div className={styles.cardHeading}>
            <h2>
              누적 평점{" "}
              <InfoMark text="이번 학기 목표 평점을 반영한 예상값입니다." />
            </h2>
            <span className={styles.cardMore}>플래너 ›</span>
          </div>

          <p className={styles.gpaChange}>
            <span>{formatGpa(previous.gpa)}</span>
            <span className={styles.gpaArrow}>→</span>
            <strong>{formatGpa(forecast)}</strong>
          </p>

          <p className={styles.description}>
            {plan.possible ? `이번 학기 목표 ${target.toFixed(2)} · 제안 평점 ${formatGpa(plan.summary.gpa)}, ${currentCredits}학점 반영` : "현재 고정 성적에서는 목표 달성이 어려워요."}
          </p>
        </section>
      </div>

      {/* 구현된 홈·학점·내 정보 메뉴를 연결한다. */}
      <nav className={styles.bottomNav} aria-label="주 메뉴">
        {navigation.map((item) => {
          const href =
            item.label === "홈"
              ? "/"
              : item.label === "학점"
                ? "/grades"
                : item.label === "내 정보"
                  ? "/my"
                  : null;

          if (href) {
            return (
              <Link
                key={item.label}
                href={href}
                className={
                  item.label === "홈" ? styles.activeNav : undefined
                }
                aria-current={item.label === "홈" ? "page" : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          }

          return (
            <button key={item.label} type="button" disabled>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <GraduationProgressDialog dialogRef={progressDialogRef} dates={dates} />
      <SemesterGpaDialog dialogRef={semesterDialogRef} />
    </main>
  );
}