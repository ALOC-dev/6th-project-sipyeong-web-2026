"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { forecastTargetGpa } from "../grades/grade-utils";
import {
  MAX_CR, additionProblem, categoryName, courseNameKey, creditsOf, evaluatePlan, evenSplit, formatDate, futureTerms, loadRoadmap,
  newRoad, offeringFor, prerequisiteNotes, recommend, refreshPlannedCourse, requirementPlans, sky, termKey, useRoads, validateRecommendedPlan,
  type CatalogCourse, type PlannedCourse, type Semester,
} from "../plan-data";
import { formatGraduationPeriod } from "../profile-model";
import { useSemesterTarget } from "../semester-target";
import { Sheet, SkyHead, XIcon, cx, s, useToast } from "../sky-ui";
import { useApi } from "../use-api";
import { WeatherIcon } from "../weather-icon";

const divisions = ["전공필수", "전공선택", "교양필수", "교양선택", "일반선택", "미분류"];
const semesterLabels: Record<string, string> = { "10": "1학기", "20": "2학기", SUMMER: "여름", WINTER: "겨울" };
type Loaded = Awaited<ReturnType<typeof loadRoadmap>>;

export default function RoadPage() {
  const router = useRouter();
  const { data, error, reload } = useApi(loadRoadmap);
  const incomplete = data?.me.profileCompleted === false;
  useEffect(() => { if (incomplete) router.replace("/start"); }, [incomplete, router]);

  return <div className={cx(s.page, s.roadPage)}><main className={s.screen}>
    {data?.me.profile && data.roadmap
      ? <Road key={data.me.userId} userId={data.me.userId} profile={data.me.profile} roadmap={data.roadmap} />
      : <section className={s.card}>
        <h1>로드맵</h1>
        {error ? <><p role="alert">{error}</p><button type="button" className={s.lock} onClick={reload}>다시 시도</button></>
          : <p role="status">학업 정보를 불러오는 중…</p>}
      </section>}
  </main></div>;
}

function Road({ userId, profile, roadmap }: {
  userId: string; profile: NonNullable<Loaded["me"]["profile"]>; roadmap: NonNullable<Loaded["roadmap"]>;
}) {
  const [roads, update] = useRoads(userId);
  const [targetGpa] = useSemesterTarget(userId, roadmap.currentTerm);
  const [toast, toastNode] = useToast();
  const [sheet, setSheet] = useState<"credits" | "add" | "saved" | null>(null);
  const [targets, setTargets] = useState<number[]>([]);
  const [addTerm, setAddTerm] = useState("");
  const [query, setQuery] = useState("");
  const [addMessage, setAddMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [own, setOwn] = useState({ name: "", credits: "3", category: divisions[0] });
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);
  const [askId, setAskId] = useState<string | null>(null);
  const ask = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (askId && ask.current && !ask.current.open) ask.current.showModal();
  }, [askId]);

  const current = termKey(roadmap.currentTerm);
  const graduation = profile.expectedGraduation ?? profile.estimatedGraduation;
  const terms = graduation ? futureTerms(roadmap.currentTerm, graduation) : [];
  const main = roads.list.find(road => road.id === roads.main);
  const catalog = new Map(roadmap.catalog.map(course => [course.code, course]));
  const semesters: Semester[] = main ? terms.map(term => {
    const saved = main.semesters.find(item => item.term === term);
    return {
      term, target: saved?.target ?? 0,
      courses: saved?.courses.map(course =>
        refreshPlannedCourse(course, course.code === null ? undefined : catalog.get(course.code), term, current)) ?? [],
    };
  }) : [];
  const evaluation = evaluatePlan(roadmap, semesters);
  const planned = creditsOf(semesters.flatMap(semester => semester.courses));
  const remaining = requirementPlans(roadmap, []);
  const requiredCredits = remaining.find(rule => rule.type === "total_credits")?.remaining ??
    (roadmap.graduation.requirements.some(rule => rule.type === "total_credits" && rule.status === "met") ? 0 : null);
  const outstanding = requirementPlans(roadmap, evaluation.accepted).filter(rule => rule.remaining > 0);
  const plannedMajor = creditsOf(evaluation.accepted.filter(course => course.category.startsWith("전공")));
  const plannedLiberal = creditsOf(evaluation.accepted.filter(course => course.category.startsWith("교양")));
  const remainingLiberal = roadmap.recognition?.projectedLiberal != null
    ? Math.max(0, roadmap.recognition.liberalLimit - roadmap.recognition.projectedLiberal) : null;
  const activeSemester = semesters.find(item => item.term === addTerm);
  const currentGpa = roadmap.semesterGpas.find(row => row.year === roadmap.currentTerm.year &&
    row.termCode === roadmap.currentTerm.termCode)?.gpa;
  const forecast = forecastTargetGpa(roadmap.gpa.basis, roadmap.currentCredits, targetGpa);
  const activeCodes = new Set([
    ...roadmap.completed,
    ...roadmap.enrolled.map(course => course.code),
    ...semesters.flatMap(item => item.courses.map(course => course.code)),
  ]);
  const requested = targets.reduce((total, credit) => total + credit, 0);
  const askRoad = roads.list.find(road => road.id === askId);
  const canPlan = terms.length > 0 && roadmap.hasRecords;
  const unfixedRules = roadmap.graduation.requirements.some(rule =>
    ["total_credits", "category_credits", "course_credits", "course_count"].includes(rule.type) &&
    rule.status !== "met" && rule.projectedValue === null);
  const manualCourseRules = roadmap.graduation.requirements.filter(rule =>
    rule.type === "manual" && ["design12", "extra_conditions"].includes(rule.code));

  function save(change: Parameters<typeof update>[0]) {
    if (update(change)) return true;
    toast("이 브라우저에 로드맵을 저장할 수 없습니다");
    if (sheet === "add") setAddMessage("이 브라우저에 로드맵을 저장할 수 없습니다");
    return false;
  }

  function openCredits() {
    const suggested = evenSplit(terms, requiredCredits);
    setTargets(terms.map((term, index) => main?.semesters.find(item => item.term === term)?.target ?? suggested[index]));
    setSheet("credits");
  }

  function generate() {
    if (roads.list.length >= 10) return toast("로드맵은 10개까지 저장할 수 있습니다");
    const recommended = recommend(roadmap, terms, targets, main);
    const validation = validateRecommendedPlan(roadmap, recommended);
    if (!validation.ready) {
      return toast(validation.unresolved.length || !validation.outstanding.length && !validation.issues.length
        ? "졸업요건 판정에 필요한 자료를 먼저 확인해주세요."
        : validation.issues[0] ?? `졸업요건을 충족하는 계획을 만들지 못했습니다: ${validation.outstanding.map(rule => rule.title).join(", ")}`);
    }
    if (!save(next => {
      const road = newRoad(next.list, recommended);
      next.list.unshift(road);
      next.main = road.id;
    })) return;
    setSheet(null);
    toast("추천 결과를 메인 로드맵에 저장했습니다");
  }

  function editSemester(term: string, change: (semester: Semester) => void) {
    return save(next => {
      const road = next.list.find(item => item.id === main?.id);
      if (!road) return;
      const semester = road.semesters.find(item => item.term === term);
      if (semester) change(semester);
      else {
        const newSemester = { term, target: 0, courses: [] };
        change(newSemester);
        road.semesters.push(newSemester);
        road.semesters.sort((a, b) => a.term.localeCompare(b.term));
      }
    });
  }

  function openAdd(term: string) {
    setAddTerm(term);
    setFilter("");
    setQuery("");
    setAddMessage("");
    setSheet("add");
  }

  function add(course: PlannedCourse) {
    if (!activeSemester) return false;
    const problem = additionProblem(roadmap, semesters, activeSemester.term, course);
    if (problem) {
      setAddMessage(problem);
      return false;
    }
    if (editSemester(activeSemester.term, semester => semester.courses.push({ ...course, manual: true }))) {
      setAddMessage(`${course.name} 과목을 추가했습니다`);
      return true;
    }
    return false;
  }

  function addCatalog(course: CatalogCourse) {
    if (!activeSemester || activeCodes.has(course.code)) return;
    const offering = offeringFor(course, addTerm, current);
    const before = evaluation.before.get(addTerm);
    if (!offering || !before || prerequisiteNotes(course, before, evaluation.confirmed).some(note => note.blocked)) return;
    add({ code: course.code, name: course.name, category: categoryName(course), credits: offering.credits });
  }

  function addOwn() {
    const name = own.name.trim();
    const credits = Number(own.credits);
    if (!name || !Number.isInteger(credits) || credits < 0 || credits > 9 || own.credits === "") {
      return setAddMessage("과목명과 0~9 사이의 정수 학점을 입력해 주세요");
    }
    if ([...catalog.values(), ...roadmap.enrolled].some(course => courseNameKey(course.name) === courseNameKey(name))) {
      return setAddMessage("등록된 과목은 위 검색 결과에서 추가해 주세요");
    }
    if (add({ code: null, name, credits, category: own.category })) setOwn({ ...own, name: "" });
  }

  function saveName() {
    if (!rename || !rename.name.trim()) return toast("로드맵 이름을 입력해 주세요");
    if (save(next => {
      const road = next.list.find(item => item.id === rename.id);
      if (road) road.name = rename.name.trim();
    })) setRename(null);
  }

  function closeSheet() { setSheet(null); setRename(null); }
  function removeRoad() {
    if (save(next => {
      next.list = next.list.filter(item => item.id !== askId);
      if (next.main === askId) next.main = next.list[0]?.id ?? null;
    })) {
      toast("로드맵을 삭제했습니다");
      ask.current?.close();
    }
  }

  const search = query.trim().toLocaleLowerCase();
  const rows = activeSemester ? roadmap.catalog.filter(course =>
    (!filter || categoryName(course) === filter) &&
    (!search || course.name.toLocaleLowerCase().includes(search) || course.code.toLocaleLowerCase().includes(search)))
    .map(course => {
      const offering = offeringFor(course, addTerm, current);
      const notes = prerequisiteNotes(course, evaluation.before.get(addTerm) ?? evaluation.confirmed, evaluation.confirmed);
      const block = activeCodes.has(course.code) ? "이수·수강·계획 중" : !offering ? "개설 자료 없음"
        : notes.some(note => note.blocked) ? "선수과목 필요"
        : additionProblem(roadmap, semesters, addTerm, { code: course.code, name: course.name, category: categoryName(course), credits: offering!.credits })
          ? "중복 또는 학점 한도" : null;
      return { course, offering, notes, block };
    }).sort((a, b) => Number(!!a.block) - Number(!!b.block)) : [];

  return <section className={s.view}>
    <SkyHead sub={`${roadmap.currentTerm.year}년 ${semesterLabels[roadmap.currentTerm.termCode]}`} title="로드맵" foot={[
      graduation ? `${formatGraduationPeriod(graduation)} 졸업 예정` : "졸업 예정 시기 확인 필요",
      main ? `이후 학기 계획 ${planned}학점` : `이후 ${terms.length}학기`,
    ]}>
      <div className={s.skPad}>
        <div className={s.semsBox}>
          <div className={s.gh}><span>학기별 평점</span></div>
          <div className={s.sems}>
            {roadmap.semesterGpas.filter(row => row.gpa !== null &&
              !(row.year === roadmap.currentTerm.year && row.termCode === roadmap.currentTerm.termCode))
              .map(row => <button key={`${row.year}-${row.termCode}`} type="button" disabled>
                {row.year} {semesterLabels[row.termCode] ?? row.termCode}<WeatherIcon sky={sky(row.gpa!)} />{row.gpa!.toFixed(2)}
              </button>)}
            <button type="button" className={s.now} onClick={() => document.getElementById("road-current")?.scrollIntoView({ block: "start" })}>
              이번 학기{(currentGpa != null || roadmap.enrolled.length > 0) && <>
                <WeatherIcon sky={sky(currentGpa ?? targetGpa)} />{currentGpa?.toFixed(2) ?? `목표 ${targetGpa.toFixed(2)}`}
              </>}
            </button>
            {semesters.map(semester => <button type="button" key={semester.term} className={s.fut}
              onClick={() => document.getElementById(`road-${semester.term}`)?.scrollIntoView({ block: "start" })}>
              {semester.term} 계획
            </button>)}
          </div>
        </div>
      </div>
    </SkyHead>

    <div className={s.stack}>
      <div className={s.card}>
        <div className={s.ct}><h2>{main?.name ?? "남은 학기 계획"}</h2>
          {main && <button className={s.more} type="button" onClick={() => { setRename({ id: main.id, name: main.name }); setSheet("saved"); }}>이름 바꾸기</button>}
        </div>
        {!roadmap.hasRecords ? <p className={s.rdMsg}><Link href="/my#academic-files">성적표와 시간표를 올리면</Link> 이수 내역을 반영해 추천합니다.</p>
          : !terms.length ? <p className={s.rdMsg}>계획할 다음 학기가 없습니다. <Link href="/start?edit=1">졸업 예정 시기 확인</Link></p>
          : <p className={s.rdMsg}>{requiredCredits === null ? "졸업까지 필요한 학점을 확인할 자료가 부족합니다."
              : `이번 학기 이수 예정분을 반영하면 총 인정학점 기준 최소 ${requiredCredits}학점이 필요합니다.`}</p>}
        {canPlan && roadmap.catalog.length === 0 && <p className={s.rdWarn}>등록된 과목 개설 자료가 없습니다.</p>}
        {canPlan && roadmap.catalog.length > 0 && <p className={s.small}>미확정 개설 학기는 과거 개설 이력으로 추정합니다.</p>}
        {canPlan && remainingLiberal !== null &&
          <p className={s.small}>이번 학기 이수 후 교양은 총 졸업학점에 최대 {remainingLiberal}학점 더 반영됩니다.</p>}
        {main && <>
          <p className={s.small}>{formatDate(main.at)} 저장 · 취득 {roadmap.earnedCredits ?? "확인 필요"}{roadmap.earnedCredits !== null && "학점"} · 이후 계획 {planned}학점</p>
          <p className={s.small}>유효 계획 · 전공 {plannedMajor}학점 · 교양 {plannedLiberal}학점</p>
          {(unfixedRules || roadmap.projectedCredits === null) && <p className={s.rdWarn}>자료가 부족해 일부 학점 요건은 판정할 수 없습니다.</p>}
          {outstanding.length > 0 && <ul className={s.rdWarn}>
            {outstanding.map(rule => <li key={rule.title}>{rule.title} · {rule.remaining}{rule.unit === "courses" ? "과목" : "학점"} 부족</li>)}
          </ul>}
          {requiredCredits !== null && evaluation.accepted.length > 0 && !outstanding.length && !unfixedRules && !evaluation.issues.length &&
            <p className={s.small}>계산 가능한 과목·학점 요건을 모두 충족하는 계획입니다.</p>}
          {manualCourseRules.length > 0 &&
            <p className={s.small}>별도 확인 · {manualCourseRules.map(rule => rule.title).join(", ")}</p>}
          {evaluation.issues.length > 0 && <ul className={s.rdWarn}>{evaluation.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
          {semesters.some(semester => semester.courses.some(course => !course.code)) &&
            <p className={s.small}>직접 등록한 과목은 졸업요건과 선수과목 판정에 반영되지 않습니다.</p>}
          <Link href="/req" className={s.more}>졸업요건 전체 확인</Link>
        </>}
        <div className={s.rdAct}>
          {canPlan && <button className={s.cta} type="button" onClick={openCredits}>{main ? "새로 추천" : "추천 받기"}</button>}
          {roads.list.length > 0 && <button className={cx(s.cta, s.tint)} type="button" onClick={() => setSheet("saved")}>저장된 로드맵 {roads.list.length}개</button>}
        </div>
      </div>
      {roadmap.currentCredits > 0 && <section className={s.card}>
        <div className={s.ct}><h2>평점 계획</h2><Link href="/grades?tab=planner" className={s.more}>플래너</Link></div>
        <div className={s.calc}>
          <div><span>이번 학기 목표 평점</span><b>{targetGpa.toFixed(2)}</b></div>
          <div><span>목표 달성 시 예상 누적 평점</span><b>{forecast?.toFixed(2) ?? "—"}</b></div>
        </div>
      </section>}
      <div className={s.semcards}>
        <section id="road-current" className={s.card}>
          <div className={s.ct}><h2>{current} 수강 중</h2><span className={s.ctR}>{roadmap.currentCredits}학점</span></div>
          <p className={s.cgoal}>{roadmap.enrolled.length ? `목표 평점 ${targetGpa.toFixed(2)}` : "이번 학기에 등록된 수강 과목이 없습니다."}</p>
          {roadmap.enrolled.map(course => <div className={s.crow} key={course.code ?? course.name}>
            <span className={s.tx}><b>{course.name}</b><span>{course.category ?? "미분류"} · {course.credits}학점</span></span>
          </div>)}
        </section>
        {semesters.map(semester => {
          const credit = creditsOf(semester.courses);
          return <section id={`road-${semester.term}`} className={s.card} key={semester.term}>
            <div className={s.ct}><h2>{semester.term} 계획</h2><span className={s.ctR}>{credit}학점</span></div>
            {credit !== semester.target && <p className={s.cgoal}>희망 {semester.target}학점</p>}
            {semester.courses.map((course, index) => {
              const ref = course.code === null ? undefined : catalog.get(course.code);
              const offering = ref && offeringFor(ref, semester.term, current);
              const notes = ref ? prerequisiteNotes(ref, evaluation.before.get(semester.term) ?? evaluation.confirmed, evaluation.confirmed) : [];
              return <div key={`${course.code ?? course.name}-${index}`} className={s.crow}>
                <span className={s.tx}><b>{course.name}</b><span>{course.category} · {course.credits}학점{course.code === null && " · 직접 등록"}</span>
                  {offering?.estimated && <span>개설 예상</span>}
                  {notes.map(({ text, blocked }, i) => <em key={i} className={blocked ? s.warn : undefined}>{text}</em>)}
                </span>
                <button className={s.x} type="button" aria-label={`${course.name} 삭제`}
                  onClick={() => editSemester(semester.term, item => item.courses.splice(index, 1))}><XIcon /></button>
              </div>;
            })}
            <button className={s.addc} type="button" onClick={() => openAdd(semester.term)}>과목 추가</button>
          </section>;
        })}
      </div>
    </div>

    <Sheet open={sheet !== null} onClose={closeSheet}
      title={sheet === "credits" ? "학기별 학점" : sheet === "add" ? `${addTerm} 과목 추가` : "저장된 로드맵"}>
      {sheet === "credits" && <>
        {terms.map((term, index) => <div className={s.dist} key={term}>
          <b>{term}</b>
            <input className={s.creditInput} type="number" inputMode="numeric" min={0} max={MAX_CR} value={targets[index]}
            aria-label={`${term} 학점`} onChange={event => {
              const value = Math.min(MAX_CR, Math.max(0, Math.round(Number(event.target.value) || 0)));
              setTargets(previous => previous.map((credit, i) => i === index ? value : credit));
            }} />
        </div>)}
        <p>희망 {requested}학점{requiredCredits !== null && ` · 총 인정학점 기준 최소 ${requiredCredits}학점`}</p>
        <p className={s.small}>과목별 요건과 교양 인정 한도를 맞추기 위해 학기당 {MAX_CR}학점 범위에서 희망 학점을 조정할 수 있습니다.</p>
        <div className={s.rdAct}>
          <button className={cx(s.cta, s.tint)} type="button" onClick={() => setTargets(evenSplit(terms, requiredCredits))}>초기화</button>
          <button className={s.cta} type="button" onClick={generate}>추천 받기</button>
        </div>
      </>}
      {sheet === "add" && activeSemester && <>
        <p className={s.small}>검색 결과의 ‘추가’를 누르면 {addTerm} 계획에 바로 저장됩니다.</p>
        <input className={s.srch} type="search" placeholder="과목명 또는 교과번호" aria-label="과목 검색" value={query} onChange={event => setQuery(event.target.value)} />
        <div className={s.chips}>{["", ...divisions].map(category =>
          <button key={category} type="button" aria-pressed={filter === category} onClick={() => setFilter(category)}>{category || "전체"}</button>)}</div>
        <div className={s.addl}>
          {rows.slice(0, 40).map(({ course, offering, notes, block }) => <div className={s.crow} key={course.code}>
            <span className={s.tx}><b>{course.name}</b><span>{course.code} · {categoryName(course)} · {offering?.credits ?? course.credits}학점</span>
              {offering?.estimated && <span>개설 예상</span>}
              {notes.map(({ text }, index) => <em key={index}>{text}</em>)}
            </span>
            <button className={s.lock} type="button" disabled={block !== null}
              aria-label={`${course.name} ${block ?? "추가"}`} onClick={() => addCatalog(course)}>{block ?? "추가"}</button>
          </div>)}
          {rows.length > 40 && <p className={s.small}>과목명이나 교과번호로 검색하면 더 많은 과목을 찾을 수 있습니다.</p>}
          {!rows.length && <p className={s.small}>검색 결과가 없습니다.</p>}
        </div>
        <p className={s.addMessage} role="status" aria-live="polite">{addMessage}</p>
        <details className={s.manualEntry}>
          <summary>검색에 없는 과목 직접 입력</summary>
          <p className={s.small}>직접 입력한 과목은 계획 학점에만 포함되며 졸업요건과 선수과목 판정에는 반영되지 않습니다.</p>
          <div className={s.manualForm}>
            <div className={s.own}>
              <input type="text" placeholder="과목명" aria-label="직접 등록 과목명" value={own.name} onChange={event => setOwn({ ...own, name: event.target.value })} />
              <input type="number" inputMode="numeric" min={0} max={9} aria-label="직접 등록 학점" value={own.credits} onChange={event => setOwn({ ...own, credits: event.target.value })} />
              <select aria-label="직접 등록 이수구분" value={own.category} onChange={event => setOwn({ ...own, category: event.target.value })}>
                {divisions.map(division => <option key={division}>{division}</option>)}
              </select>
            </div>
            <button className={cx(s.cta, s.tint)} type="button" onClick={addOwn}>직접 입력한 과목 추가</button>
          </div>
        </details>
      </>}
      {sheet === "saved" && roads.list.map(road => <div className={s.rl} key={road.id}>
        {rename?.id === road.id ? <>
          <input className={s.srch} aria-label="로드맵 이름" maxLength={20} value={rename.name}
            onChange={event => setRename({ id: road.id, name: event.target.value })} />
          <div className={s.mact}>
            <button className={cx(s.cta, s.tint)} type="button" onClick={() => setRename(null)}>취소</button>
            <button className={s.cta} type="button" onClick={saveName}>저장</button>
          </div>
        </> : <>
          <div className={s.rlH}><b>{road.name}</b>{road.id === roads.main && <span>메인</span>}</div>
          <div className={s.small}>{formatDate(road.at)} 저장</div>
          <div className={s.rlA}>
            {road.id !== roads.main && <button className={s.lock} type="button" onClick={() => save(next => { next.main = road.id; })}>메인으로</button>}
            <button className={s.lock} type="button" onClick={() => setRename({ id: road.id, name: road.name })}>이름 바꾸기</button>
            <button className={s.lock} type="button" onClick={() => setAskId(road.id)}>삭제</button>
          </div>
        </>}
      </div>)}
    </Sheet>

    <dialog ref={ask} className={s.ask} aria-labelledby="road-delete-title" onClose={() => setAskId(null)}>
      <h3 id="road-delete-title">로드맵 삭제</h3>
      <p>{askRoad?.name}</p>
      <div className={s.mact}>
        <button className={cx(s.cta, s.tint)} type="button" onClick={() => ask.current?.close()}>취소</button>
        <button className={cx(s.cta, s.bad)} type="button" onClick={removeRoad}>삭제</button>
      </div>
    </dialog>
    {toastNode}
  </section>;
}
