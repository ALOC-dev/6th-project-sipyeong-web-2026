"use client";

import Link from "next/link";
import { AppIcon } from "./app-icon";
import { useState } from "react";
import { HelpButton } from "./help-button";
import { HomeHelpDialog } from "./home-help-dialog";
import type { HomeHelpKind } from "./home-help-dialog";
import { HomeHero } from "./home-hero";
import styles from "./page.module.css";
import { useStudentProfile } from "./profile-provider";
import { getEngineeringStatus, getRemainingSemesterCount, formatGraduationPeriod } from "./profile-model";
import { useGradePlan } from "./grade-plan-provider";

// 홈과 학점·도움말이 공통 날씨 판정과 아이콘을 사용한다.

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

/* 메인 화면 */
export default function Home() {
  const [help, setHelp] = useState<HomeHelpKind | null>(null);
  const { profile } = useStudentProfile();
  const { data, previous, previousMajor, currentCredits, target, plan, forecast } = useGradePlan();
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

  return (
    <main className={styles.page}>
      <HomeHero />

      {/* 본문 */}
      <div className={styles.content}>
<div className={styles.primaryColumn}>
        {/* 요약 카드 */}
        <section
          className={`${styles.card} ${styles.summaryCard}`}
        >
          <div className={styles.cardHeading}>
            <h2>
              요약{" "}
              <HelpButton label="현재 성적과 학적 정보의 요약입니다." onClick={() => setHelp("summary") } />
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
                  <AppIcon name="chevron" className={styles.chevron} />
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
              <HelpButton label="이번 학기 수강 내역을 포함한 예시입니다." onClick={() => setHelp("requirements") } />
            </h2>
            <span className={styles.cardMore}>전체<AppIcon name="chevron" /></span>
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

                <AppIcon name="chevron" className={styles.chevron} />
              </div>

              {item.note && (
                <p className={styles.warning}>{item.note}</p>
              )}
            </div>
          ))}
        </section>

</div>
<div className={styles.secondaryColumn}>
        {/* 마이크로디그리 카드 */}
        <Link href="/degrees"
          className={`${styles.card} ${styles.degreeCard}`}
        >
          <div>
            <h2>빅데이터 초급 신청 가능</h2>
            <p className={styles.description}>2027.02까지 신청</p>
          </div>

          <AppIcon name="chevron" className={styles.chevron} />
        </Link>
        {/* 추천 과목 카드 */}
        <section
          className={`${styles.card} ${styles.recommendationsCard}`}
        >
          <div className={styles.cardHeading}>
            <h2>
              2027-1 추천 과목{" "}
              <HelpButton label="이수 내역을 기준으로 추천하는 과목입니다." onClick={() => setHelp("recommendations") } />
            </h2>
            <span className={styles.cardMore}>전체<AppIcon name="chevron" /></span>
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
              <HelpButton label="이번 학기 목표 평점을 반영한 예상값입니다." onClick={() => setHelp("gpa") } />
            </h2>
            <span className={styles.cardMore}>플래너<AppIcon name="chevron" /></span>
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
      </div>

      {help && <HomeHelpDialog kind={help} onClose={() => setHelp(null)} />}
    </main>
  );
}