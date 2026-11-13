import Link from "next/link";
import styles from "./page.module.css";

/* 날씨 종류 */
type WeatherType =
  | "rainbow"
  | "sunny"
  | "partly"
  | "cloudy"
  | "rain"
  | "pending";

/* 평점을 날씨로 변환 */
function getWeatherType(gpa: number | null): WeatherType {
  if (gpa === null) return "pending";
  if (gpa >= 4.5) return "rainbow";
  if (gpa >= 4.0) return "sunny";
  if (gpa >= 3.5) return "partly";
  if (gpa >= 3.0) return "cloudy";
  return "rain";
}

/* 날씨 아이콘 */
function WeatherIcon({ type }: { type: WeatherType }) {
  const labels: Record<WeatherType, string> = {
    rainbow: "무지개",
    sunny: "맑음",
    partly: "구름 조금",
    cloudy: "흐림",
    rain: "비",
    pending: "성적 미확정",
  };

  const showSun = type === "sunny" || type === "partly";
  const showCloud =
    type === "partly" || type === "cloudy" || type === "rain";

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={labels[type]}
    >
      {type === "rainbow" && (
        <g strokeWidth="3" strokeLinecap="round">
          <path d="M3 25a13 13 0 0 1 26 0" stroke="#FF8795" />
          <path d="M7 25a9 9 0 0 1 18 0" stroke="#FFD15C" />
          <path d="M11 25a5 5 0 0 1 10 0" stroke="#86E0CA" />
        </g>
      )}

      {showSun && (
        <g
          stroke="#FFD15C"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="15" cy="13" r="5" fill="#FFD15C" />
          <path d="M15 2v3M15 21v3M4 13h3M23 13h3" />
          <path d="m7 5 2 2m12 12 2 2M7 21l2-2M21 7l2-2" />
        </g>
      )}

      {showCloud && (
        <g
          transform={
            type === "rain" ? "translate(0 -4)" : undefined
          }
        >
          <path
            d="M8 27a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 1 1 3 12H8Z"
            fill={type === "rain" ? "#C5D5E8" : "#FFFFFF"}
          />
        </g>
      )}

      {type === "rain" && (
        <g
          stroke="#BDE7FF"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="m10 26-1 3" />
          <path d="m17 26-1 3" />
          <path d="m24 26-1 3" />
        </g>
      )}

      {type === "pending" && (
        <g stroke="currentColor" strokeWidth="1.5">
          <circle
            cx="16"
            cy="16"
            r="10"
            strokeDasharray="3 3"
            opacity=".5"
          />
          <path d="M12 16h8" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

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
function InfoMark({ text }: { text: string }) {
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

/* 화면 확인용 예시 데이터 */
type Semester = {
  label: string;
  gpa: number | null;
  current?: boolean;
};

const semesters: Semester[] = [
  { label: "1-1", gpa: 3.2 },
  { label: "1-2", gpa: 3.7 },
  { label: "2-1", gpa: 4.0 },
  { label: "2-2", gpa: 4.5 },
  { label: "3-1", gpa: 2.8 },
  { label: "지금", gpa: null, current: true },
  { label: "4-1", gpa: null },
  { label: "4-2", gpa: null },
];

const summaryItems = [
  {
    label: "평점",
    description: "전공 3.84",
    value: "3.78",
  },
  {
    label: "인정 학점",
    description: "취득 79학점",
    value: "76학점",
  },
  {
    label: "이번 학기",
    description: "7과목, 12.19 종강",
    value: "21학점",
  },
  {
    label: "남은 학기",
    description: "2027-2 졸업 예정",
    value: "3학기",
  },
];

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
  const graduationProgress = 67.43;
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

          <InfoMark text="졸업 예정일까지의 기간 진행률입니다." />
        </div>

        <p className={styles.percentage}>
          {graduationProgress.toFixed(2)}
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
          aria-label={`졸업까지의 기간 진행률 ${graduationProgress}%`}
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
          <span>입학 2024.03.04</span>
          <strong>졸업 D-474</strong>
        </div>

        {/* 학기별 날씨 */}
        <section className={styles.semesterSection}>
          <div className={styles.sectionHeading}>
            <h2>학기별 평점</h2>

            <InfoMark
              text="4.5 무지개 / 4.0 이상 맑음 / 3.5 이상 구름 조금 / 3.0 이상 흐림 / 3.0 미만 비"
            />
          </div>

          <div className={styles.semesterGrid}>
            {semesters.map((semester) => (
              <div
                key={semester.label}
                className={`${styles.semester} ${
                  semester.current ? styles.currentSemester : ""
                }`}
                title={
                  semester.gpa === null
                    ? "성적 미확정"
                    : `평점 ${semester.gpa.toFixed(2)}`
                }
              >
                <span>{semester.label}</span>
                <WeatherIcon type={getWeatherType(semester.gpa)} />
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

          {requirements.map((item) => (
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
            <span>3.78</span>
            <span className={styles.gpaArrow}>→</span>
            <strong>3.77</strong>
          </p>

          <p className={styles.description}>
            이번 학기 목표 3.75, 21학점 반영
          </p>
        </section>
      </div>

      {/* 공통 메뉴: 화면 연결 전 */}
      <nav className={styles.bottomNav} aria-label="주 메뉴">
        {navigation.map((item) => {
          const href =
            item.label === "홈"
              ? "/"
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
    </main>
  );
}