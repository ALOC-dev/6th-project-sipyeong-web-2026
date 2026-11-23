import { useRef, useState, type FormEvent } from "react";
import type { CurriculumRule } from "../academic-account";
import type { Department, LanguageScore, Profile } from "../api-client";
import styles from "./page.module.css";

const admissionYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
const maxScores = 50;

export type ProfileChanges = Partial<Pick<Profile, "departmentId" | "admissionYear" | "volunteerHours" | "languageScores">> & {
  curriculumYear?: number;
};

type ScoreDraft = { id: number; examType: string; score: string; grade: string; takenAt: string };

function defaultCurriculum(options: number[], current = "") {
  if (!options.length || options.includes(Number(current))) return current;
  return options.length === 1 ? String(options[0]) : "";
}

export function ProfileForm({ profile, departments, rules, busy, stale, editing, onSave }: {
  profile: Profile | null;
  departments: Department[];
  rules: CurriculumRule[];
  busy: boolean;
  stale: boolean;
  editing: boolean;
  onSave: (changes: ProfileChanges) => void;
}) {
  const getYears = (departmentId: string, year: string) => rules
    .filter(rule => rule.departmentId === departmentId && rule.admissionYear === Number(year))
    .map(rule => rule.curriculumYear);
  const [departmentId, setDepartmentId] = useState(profile?.departmentId ?? (departments.length === 1 ? departments[0].departmentId : ""));
  const [admissionYear, setAdmissionYear] = useState(String(profile?.admissionYear ?? ""));
  const [curriculumYear, setCurriculumYear] = useState(() => defaultCurriculum(
    getYears(departmentId, admissionYear), String(profile?.curriculumYear ?? ""),
  ));
  const savedVolunteerHours = String(profile?.volunteerHours ?? "");
  const [volunteerHours, setVolunteerHours] = useState(savedVolunteerHours);
  const [volunteerError, setVolunteerError] = useState("");
  const [scores, setScores] = useState<ScoreDraft[]>(() => (profile?.languageScores ?? []).map((entry, id) => ({
    id, examType: entry.examType, score: String(entry.score ?? ""), grade: entry.grade ?? "", takenAt: entry.takenAt ?? "",
  })));
  const nextScoreId = useRef(scores.length);
  const [invalidScore, setInvalidScore] = useState<{ id: number; text: string }>();
  const knownCurriculumYears = getYears(departmentId, admissionYear);
  const savedCurriculumYear = profile?.curriculumYear;
  const curriculumOptions = knownCurriculumYears.length ? knownCurriculumYears : [
    ...new Set(savedCurriculumYear == null ? admissionYears : [...admissionYears, savedCurriculumYear]),
  ].sort((first, second) => second - first);
  const disabled = busy || stale || departments.length === 0;

  function changeEnrollment(department: string, year: string) {
    setDepartmentId(department);
    setAdmissionYear(year);
    setCurriculumYear(defaultCurriculum(getYears(department, year)));
  }

  function updateScore(id: number, field: keyof Omit<ScoreDraft, "id">, value: string) {
    if (invalidScore?.id === id) setInvalidScore(undefined);
    setScores(previous => previous.map(row => row.id === id ? { ...row, [field]: value } : row));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hours = volunteerHours.trim();
    if (hours !== "" && hours !== savedVolunteerHours && (!/^\d+$/.test(hours) || Number(hours) > 99_999)) {
      setVolunteerError("봉사시간을 0~99,999 사이의 정수로 입력해 주세요.");
      event.currentTarget.querySelector<HTMLInputElement>("#sVolunteer")?.focus();
      return;
    }
    const languageScores: LanguageScore[] = [];
    for (const row of scores) {
      const examType = row.examType.trim();
      const grade = row.grade.trim();
      const score = row.score === "" ? null : Number(row.score);
      if (!examType || (score === null && !grade)) {
        setInvalidScore({ id: row.id, text: "시험명과 점수 또는 등급을 입력해 주세요." });
        event.currentTarget.querySelector<HTMLInputElement>(`#${examType ? "score" : "exam"}-${row.id}`)?.focus();
        return;
      }
      languageScores.push({ examType, score, grade: grade || null, takenAt: row.takenAt || null });
    }
    const admission = Number(admissionYear);
    const curriculum = Number(curriculumYear);
    const volunteer = hours === "" ? null : Number(hours);
    const originalScores = profile?.languageScores ?? [];
    const scoresChanged = originalScores.length !== languageScores.length || languageScores.some((row, index) => {
      const original = originalScores[index];
      return !original || row.examType !== original.examType || row.score !== original.score ||
        row.grade !== original.grade || row.takenAt !== original.takenAt;
    });
    if (scoresChanged) {
      const exams = new Set<string>();
      const duplicate = languageScores.findIndex(({ examType }) => {
        const key = examType.toLowerCase();
        if (exams.has(key)) return true;
        exams.add(key);
        return false;
      });
      if (duplicate >= 0) {
        const { id } = scores[duplicate];
        setInvalidScore({ id, text: "같은 시험의 성적은 한 항목만 입력해 주세요." });
        event.currentTarget.querySelector<HTMLInputElement>(`#exam-${id}`)?.focus();
        return;
      }
    }
    onSave({
      ...(departmentId !== profile?.departmentId && { departmentId }),
      ...(admission !== profile?.admissionYear && { admissionYear: admission }),
      ...(curriculum !== profile?.curriculumYear && { curriculumYear: curriculum }),
      ...(volunteer !== (profile?.volunteerHours ?? null) && { volunteerHours: volunteer }),
      ...(scoresChanged && { languageScores }),
    });
  }

  return (
    <form onSubmit={submit} className={styles.stack}>
      <div className={styles.g2}>
        <fieldset className={styles.card} disabled={disabled}>
          <h2>기본 학적 정보</h2>
          <div className={styles.field}>
            <label htmlFor="sDept">학과</label>
            <select id="sDept" required value={departmentId} onChange={(event) => changeEnrollment(event.target.value, admissionYear)}>
              <option value="" disabled>학과 선택</option>
              {departments.map(department => (
                <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="sYear">입학연도</label>
            <select id="sYear" required value={admissionYear} onChange={(event) => changeEnrollment(departmentId, event.target.value)}>
              <option value="" disabled>입학연도 선택</option>
              {admissionYears.map(year => <option key={year} value={year}>{year}학년도</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="sCurriculum">적용 교육과정 연도</label>
            <select id="sCurriculum" required value={curriculumYear} disabled={!admissionYear}
              onChange={(event) => setCurriculumYear(event.target.value)}
              aria-describedby={admissionYear && !knownCurriculumYears.length ? "curriculum-help" : undefined}>
              <option value="" disabled>{admissionYear ? "교육과정 연도 선택" : "입학연도를 먼저 선택해 주세요"}</option>
              {admissionYear && curriculumOptions.map(year => <option key={year} value={year}>{year}학년도</option>)}
            </select>
            {admissionYear && !knownCurriculumYears.length && (
              <span id="curriculum-help" className={styles.hint}>등록된 학교 기준이 없어요. 학교에서 안내받은 연도를 선택해 주세요.</span>
            )}
          </div>
          {departmentId === "34" && <details className={styles.guide}>
            <summary>공학교육인증 안내</summary>
            <p className={styles.ctext}>컴퓨터과학부의 심화프로그램은 일반 졸업요건과 공학교육인증 요건을 함께 적용합니다. 일반프로그램으로 전환을 승인받거나 편입·전과 후 일반프로그램에 배정된 경우에는 일반 졸업요건이 적용됩니다. 본인 소속 프로그램은 학교에서 확인해 주세요.</p>
          </details>}
        </fieldset>
        <fieldset className={styles.card} disabled={disabled}>
          <h2>선택 입력</h2>
          <div className={styles.field}>
            <label htmlFor="sVolunteer">봉사시간</label>
            <input id="sVolunteer" type="text" inputMode="numeric" value={volunteerHours}
              onChange={(event) => { setVolunteerHours(event.target.value); setVolunteerError(""); }}
              aria-invalid={Boolean(volunteerError)}
              aria-describedby={volunteerError ? "volunteer-help volunteer-error" : "volunteer-help"} />
            <span id="volunteer-help" className={styles.hint}>누적 봉사시간을 시간 단위의 정수로 입력해 주세요. 비워 두면 미입력으로 저장돼요.</span>
            {volunteerError && <span id="volunteer-error" className={styles.bad} role="alert">{volunteerError}</span>}
          </div>
          <div className={styles.field}>
            <h3>어학성적</h3>
            {scores.map((row, index) => (
              <fieldset key={row.id} className={styles.scoreRow}>
                <legend>어학성적 {index + 1}</legend>
                <label htmlFor={`exam-${row.id}`}>시험명</label>
                <input id={`exam-${row.id}`} type="text" maxLength={100} value={row.examType} placeholder="예: TOEIC"
                  onChange={(event) => updateScore(row.id, "examType", event.target.value)} />
                <div className={styles.scoreFields}>
                  <label>점수<input id={`score-${row.id}`} type="number" min="0" step="any" value={row.score}
                    onChange={(event) => updateScore(row.id, "score", event.target.value)} /></label>
                  <label>등급<input type="text" maxLength={100} value={row.grade} placeholder="예: IH"
                    onChange={(event) => updateScore(row.id, "grade", event.target.value)} /></label>
                </div>
                <label htmlFor={`date-${row.id}`}>응시일 (선택)</label>
                <input id={`date-${row.id}`} type="date" min="0001-01-01" max="9999-12-31" value={row.takenAt}
                  onChange={(event) => updateScore(row.id, "takenAt", event.target.value)} />
                {invalidScore?.id === row.id && <p role="alert" className={styles.bad}>{invalidScore.text}</p>}
                <button type="button" className={styles.textButton} aria-label={`어학성적 ${index + 1} 삭제`} onClick={() => {
                  if (invalidScore?.id === row.id) setInvalidScore(undefined);
                  setScores(previous => previous.filter(entry => entry.id !== row.id));
                }}>삭제</button>
              </fieldset>
            ))}
            <button type="button" className={styles.textButton} disabled={scores.length >= maxScores} onClick={() => {
              const id = nextScoreId.current++;
              setScores(previous => [...previous, { id, examType: "", score: "", grade: "", takenAt: "" }]);
            }}>어학성적 추가</button>
          </div>
        </fieldset>
      </div>
      {departments.length === 0 && <p role="status">등록된 학과가 없어요. 학과를 등록한 뒤 다시 시도해 주세요.</p>}
      <button className={`${styles.cta} ${styles.tap}`} type="submit" disabled={disabled}>
        {busy ? "저장 중…" : editing ? "저장" : "저장하고 다음"}
      </button>
    </form>
  );
}
