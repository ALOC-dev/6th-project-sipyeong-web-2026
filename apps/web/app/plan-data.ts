import { useSyncExternalStore } from "react";
import { api, type Me } from "./api-client";
import type { Graduation, HomeOverview } from "./home-data";
import { getLastStudySemester, getRemainingSemesterCount } from "./profile-model";
import type { Sky } from "./weather-icon";

type AcademicTerm = HomeOverview["currentTerm"];
type Offering = AcademicTerm & { credits: number };
type Prerequisite = {
  relation: "required" | "recommended";
  rule: "all" | "any";
  courses: { code: string; name: string }[];
};
export type CatalogCourse = {
  id: number; code: string; name: string; category: string | null; categoryCode: string | null; area?: string | null;
  credits: number; offerings: Offering[]; prerequisites: Prerequisite[];
};
export type PlannedCourse = { code: string | null; name: string; category: string; credits: number; manual?: boolean };
export type Semester = { term: string; target: number; courses: PlannedCourse[] };
export type Road = { id: string; name: string; at: number; semesters: Semester[] };
export type Roads = { list: Road[]; main: string | null };
export interface Roadmap {
  currentTerm: AcademicTerm;
  gpa: HomeOverview["gpa"];
  semesterGpas: HomeOverview["semesterGpas"];
  earnedCredits: number | null;
  projectedCredits: number | null;
  recognition: HomeOverview["credits"]["recognition"];
  currentCredits: number;
  graduation: Graduation;
  completed: string[];
  enrolled: PlannedCourse[];
  catalog: CatalogCourse[];
  hasRecords: boolean;
}

export async function loadRoadmap(signal: AbortSignal) {
  const { data: me } = await api<Me>("users/me", { signal });
  const roadmap = me.profileCompleted ? (await api<Roadmap>("me/roadmap", { signal })).data : null;
  return { me, roadmap };
}

export const MAX_CR = 20;
export const sky = (g: number): Sky => g >= 4 ? "sun" : g >= 3.7 ? "sunc" : g >= 3.5 ? "cloud" : "rain";
export const creditsOf = (courses: PlannedCourse[]) => roundCredits(courses.reduce((sum, course) => sum + course.credits, 0));
export const roundCredits = (credit: number) => Math.round(credit * 10) / 10;
export const termKey = ({ year, termCode }: AcademicTerm) => `${year}-${termCode === "10" ? 1 : 2}`;
export function futureTerms(current: AcademicTerm, graduation: NonNullable<NonNullable<Me["profile"]>["estimatedGraduation"]>) {
  const { graduationYear, graduationMonth } = graduation;
  const currentKey = termKey(current);
  const last = getLastStudySemester(graduationYear, graduationMonth);
  if (last <= currentKey) return [];
  const semesters = getRemainingSemesterCount(currentKey, graduationYear, graduationMonth) - 1;
  const first = current.year * 2 + (current.termCode === "20" ? 1 : 0) + 1;
  return Array.from({ length: semesters }, (_, index) => {
    const order = first + index;
    return `${Math.floor(order / 2)}-${order % 2 + 1}`;
  });
}

const categoryNames: Record<string, string> = {
  major_required: "전공필수", major_elective: "전공선택", general_elective: "일반선택",
  liberal_required: "교양필수", liberal_elective: "교양선택",
};
export function categoryName(course: CatalogCourse) {
  return (course.categoryCode && categoryNames[course.categoryCode]) || course.category || "미분류";
}

const isLiberal = (course: CatalogCourse) =>
  ["교양필수", "교양선택", "교양", "교필", "교선", "기초교양"].includes(categoryName(course));
const knownNonLiberal = (course: CatalogCourse) => !!course.categoryCode ||
  ["전공필수", "전공선택", "일반선택", "자유선택", "교직", "기타"].includes(categoryName(course));

export function offeringFor(course: CatalogCourse, term: string, current: string) {
  const exact = course.offerings.find(offering => termKey(offering) === term);
  if (exact) return { credits: exact.credits, estimated: false };
  const previous = course.offerings.find(offering => termKey(offering) <= current && termKey(offering).endsWith(term.slice(-2)));
  return previous ? { credits: previous.credits, estimated: true } : null;
}

export function prerequisiteNotes(course: CatalogCourse, before: ReadonlySet<string>, confirmed: ReadonlySet<string>) {
  const satisfied = (group: Prerequisite, by: ReadonlySet<string>) => group.courses.length > 0 &&
    (group.rule === "all" ? group.courses.every(item => by.has(item.code)) : group.courses.some(item => by.has(item.code)));
  return course.prerequisites.flatMap(group => {
    const names = group.courses.map(item => item.name).join(group.rule === "all" ? "·" : " 또는 ");
    const required = group.relation === "required";
    if (!satisfied(group, before)) return [{
      blocked: required,
      text: names ? `${required ? "필수" : "권장"} 선수과목: ${names}` : "선수과목 자료 확인 필요",
    }];
    return satisfied(group, confirmed) ? [] : [{ blocked: false, text: `${names} 이수 전제` }];
  });
}

export function evenSplit(terms: string[], remaining: number | null) {
  const total = Math.ceil(remaining ?? 0);
  return terms.map((_, index) => Math.min(MAX_CR, Math.floor(total / terms.length) + Number(index < total % terms.length)));
}

export function requirementPlans(roadmap: Roadmap, accepted: PlannedCourse[]) {
  const byCode = new Map(roadmap.catalog.map(course => [course.code, course]));
  return roadmap.graduation.requirements.flatMap(rule => {
    if (!["total_credits", "category_credits", "course_credits", "course_count"].includes(rule.type) ||
      rule.status === "met" || rule.requiredValue === null || rule.projectedValue === null) return [];
    const enrolled = new Set(rule.enrolledCourses.map(course => course.course_id));
    const missing = new Set(rule.missingCourses.filter(course => !enrolled.has(course.course_id)).map(course => course.course_id));
    const accepts = (course: CatalogCourse) => rule.type === "total_credits" ||
      (rule.type === "category_credits" ? rule.categoryCode === course.categoryCode : missing.has(course.id));
    const addsToTotal = rule.type === "total_credits";
    const liberalRoom = roadmap.recognition ? Math.max(0, roadmap.recognition.liberalLimit -
      (roadmap.recognition.projectedLiberal ?? roadmap.recognition.liberalLimit)) : Infinity;
    let liberalCredits = 0;
    const added = accepted.reduce((count, planned) => {
      const course = planned.code === null ? undefined : byCode.get(planned.code);
      if (course && addsToTotal && roadmap.recognition) {
        if (isLiberal(course)) {
          liberalCredits += planned.credits;
          return count;
        }
        if (!knownNonLiberal(course)) return count;
      }
      return count + (course && accepts(course) ? (rule.unit === "courses" ? 1 : planned.credits) : 0);
    }, 0);
    return [{ code: rule.code, title: rule.title, unit: rule.unit, type: rule.type, accepts,
      remaining: Math.max(0, roundCredits(rule.requiredValue - rule.projectedValue - added - Math.min(liberalRoom, liberalCredits))) }];
  });
}

export function refreshPlannedCourse(planned: PlannedCourse, course: CatalogCourse | undefined, term: string, current: string) {
  const offering = course && offeringFor(course, term, current);
  return course && offering ? { ...planned, name: course.name, category: categoryName(course), credits: offering.credits } : planned;
}

export const courseNameKey = (name: string) => name.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase();

export function additionProblem(roadmap: Roadmap, semesters: Semester[], term: string, course: PlannedCourse) {
  const semester = semesters.find(item => item.term === term);
  if (!semester) return "추가할 학기를 다시 선택해주세요";
  const name = courseNameKey(course.name);
  const duplicate = [...roadmap.enrolled, ...semesters.flatMap(item => item.courses)].some(item =>
    (course.code !== null && item.code === course.code) ||
    ((course.code === null || item.code === null) && courseNameKey(item.name) === name));
  const completed = course.code !== null ? roadmap.completed.includes(course.code)
    : roadmap.catalog.some(item => roadmap.completed.includes(item.code) && courseNameKey(item.name) === name);
  if (duplicate || completed) return "이미 이수·수강 중이거나 다른 학기를 포함한 계획에 있는 과목입니다";
  if (roundCredits(creditsOf(semester.courses) + course.credits) > MAX_CR) return `한 학기에 ${MAX_CR}학점까지 계획할 수 있습니다`;
  return null;
}

export function evaluatePlan(roadmap: Roadmap, semesters: Semester[]) {
  const confirmed = new Set(roadmap.completed);
  const ready = new Set([...confirmed, ...roadmap.enrolled.flatMap(course => course.code ?? [])]);
  const catalog = new Map(roadmap.catalog.map(course => [course.code, course]));
  const current = termKey(roadmap.currentTerm);
  const accepted: PlannedCourse[] = [];
  const before = new Map<string, Set<string>>();
  const issues: string[] = [];
  for (const semester of semesters) {
    before.set(semester.term, new Set(ready));
    const thisTerm = new Set<string>();
    const courses = semester.courses.map(course =>
      refreshPlannedCourse(course, course.code === null ? undefined : catalog.get(course.code), semester.term, current));
    const credits = creditsOf(courses);
    if (credits > MAX_CR) {
      issues.push(`${semester.term} · 개설 학점 기준 ${credits}학점으로 학기당 ${MAX_CR}학점 한도를 초과했습니다.`);
      continue;
    }
    for (const planned of courses) {
      if (planned.code === null) continue;
      const course = catalog.get(planned.code);
      const offering = course && offeringFor(course, semester.term, current);
      const missing = course && prerequisiteNotes(course, ready, confirmed).filter(note => note.blocked);
      const warning = !offering ? "개설 자료 확인 필요"
        : ready.has(planned.code) || thisTerm.has(planned.code) ? "이미 이수·수강·계획한 과목"
        : missing?.map(note => note.text).join(" / ");
      if (warning) issues.push(`${semester.term} ${planned.name} · ${warning}`);
      else {
        thisTerm.add(planned.code);
        accepted.push(planned);
      }
    }
    for (const code of thisTerm) ready.add(code);
  }
  return { confirmed, before, accepted, issues };
}

// Course plans certify course/credit requirements; manual requirements remain separate.
export function validateRecommendedPlan(roadmap: Roadmap, semesters: Semester[]) {
  const evaluation = evaluatePlan(roadmap, semesters);
  const outstanding = requirementPlans(roadmap, evaluation.accepted).filter(rule => rule.remaining > 0);
  const unresolved = roadmap.graduation.requirements.filter(rule =>
    ["total_credits", "category_credits", "course_credits", "course_count"].includes(rule.type) &&
    rule.status !== "met" && (rule.requiredValue === null || rule.projectedValue === null));
  const hasTotal = roadmap.graduation.requirements.some(rule => rule.type === "total_credits");
  return { ...evaluation, outstanding, unresolved,
    ready: hasTotal && !evaluation.issues.length && !outstanding.length && !unresolved.length };
}

export function recommend(roadmap: Roadmap, terms: string[], targets: number[], existing?: Road) {
  const current = termKey(roadmap.currentTerm);
  const currentCourses = new Set([...roadmap.completed, ...roadmap.enrolled.map(course => course.code)]);
  const known = new Map(roadmap.catalog.map(course => [course.code, course]));
  const options = roadmap.catalog.filter(course => !currentCourses.has(course.code)).flatMap(course => {
    const slots = terms.flatMap((term, index) => {
      const offering = offeringFor(course, term, current);
      return offering ? [{ index, offering }] : [];
    });
    return slots.length ? [{ course, slots }] : [];
  });
  const startingRules = requirementPlans(roadmap, []);
  const hasTotal = startingRules.some(rule => rule.type === "total_credits") ||
    roadmap.graduation.requirements.some(rule => rule.type === "total_credits" && rule.status === "met");
  const isMajor = (course: CatalogCourse) => /^전공/.test(categoryName(course));
  const area = (course: CatalogCourse) => course.area || categoryName(course);
  const impact = (rule: typeof startingRules[number], course: CatalogCourse, credits: number) =>
    rule.accepts(course) ? Math.min(rule.remaining, rule.unit === "courses" ? 1 : credits) : 0;
  const recognizedContribution = (course: CatalogCourse, credits: number, liberalRoom: number) => isLiberal(course)
    ? Math.min(credits, liberalRoom)
    : knownNonLiberal(course) ? credits : 0;

  function build(strategy: number) {
    const semesters: Semester[] = terms.map((term, index) => ({
      term, target: targets[index] ?? 0,
      courses: existing?.semesters.find(item => item.term === term)?.courses.filter(course => course.manual)
        .map(course => refreshPlannedCourse(course, course.code === null ? undefined : known.get(course.code), term, current)) ?? [],
    }));
    const names = new Set(semesters.flatMap(semester => semester.courses.flatMap(course => course.code === null ? [course.name] : [])));
    while (true) {
      const evaluation = evaluatePlan(roadmap, semesters);
      const open = requirementPlans(roadmap, evaluation.accepted).filter(rule => rule.remaining > 0);
      const specific = open.filter(rule => rule.type !== "total_credits");
      const total = open.find(rule => rule.type === "total_credits");
      const used = new Set(semesters.flatMap(semester => semester.courses.map(course => course.code)));
      const remainingOptions = options.filter(({ course }) => !used.has(course.code) && !names.has(course.name));
      const loads = semesters.map(semester => creditsOf(semester.courses));
      const acceptedCatalog = evaluation.accepted.flatMap(course => {
        const ref = course.code && known.get(course.code);
        return ref ? [{ course: ref, credits: course.credits }] : [];
      });
      const liberalUsed = acceptedCatalog.reduce((sum, row) => sum + (isLiberal(row.course) ? row.credits : 0), 0);
      const liberalRoom = roadmap.recognition ? Math.max(0, roadmap.recognition.liberalLimit -
        (roadmap.recognition.projectedLiberal ?? roadmap.recognition.liberalLimit) - liberalUsed) : Infinity;
      const areas = new Map<string, number>();
      for (const { course } of acceptedCatalog) {
        if (isLiberal(course)) areas.set(area(course), (areas.get(area(course)) ?? 0) + 1);
      }

      const unlock = new Map<string, number>();
      function markPrerequisites(course: CatalogCourse, index: number, depth = 0) {
        if (index <= 0 || depth >= terms.length) return;
        const before = evaluation.before.get(terms[index])!;
        for (const group of course.prerequisites) {
          if (group.relation !== "required" || (group.rule === "any" && group.courses.some(item => before.has(item.code)))) continue;
          for (const item of group.courses) {
            if (before.has(item.code) || used.has(item.code)) continue;
            const predecessor = known.get(item.code);
            if (!predecessor) continue;
            const earlier = terms.slice(0, index).findLastIndex((term, slot) => {
              const offering = offeringFor(predecessor, term, current);
              return offering && roundCredits(loads[slot] + offering.credits) <= MAX_CR;
            });
            if (earlier < 0) continue;
            unlock.set(item.code, Math.max(unlock.get(item.code) ?? 0, earlier + 1));
            markPrerequisites(predecessor, earlier, depth + 1);
          }
        }
      }

      for (const { course, slots } of remainingOptions) {
        if (!specific.some(rule => rule.accepts(course))) continue;
        const last = slots.findLast(slot => roundCredits(loads[slot.index] + slot.offering.credits) <= MAX_CR);
        if (last) markPrerequisites(course, last.index);
      }
      for (const [index, semester] of semesters.entries()) {
        for (const planned of semester.courses) {
          const course = planned.manual && planned.code !== null ? known.get(planned.code) : undefined;
          if (course && offeringFor(course, semester.term, current) && loads[index] <= MAX_CR) markPrerequisites(course, index);
        }
      }
      const weights = specific.map(rule => {
        const candidates = remainingOptions.filter(({ course, slots }) => rule.accepts(course) &&
          slots.some(slot => roundCredits(loads[slot.index] + slot.offering.credits) <= MAX_CR)).length;
        return 1 + (rule.code.startsWith("professional") ? 0.35 : 0) +
          Math.min(1.1, rule.remaining / Math.max(1, candidates) * (strategy % 2 ? 0.7 : 0.35));
      });

      let pick: { course: CatalogCourse; index: number; credits: number; score: number } | undefined;
      for (const { course, slots } of remainingOptions) {
        const division = categoryName(course);
        for (const { index, offering } of slots) {
          const credits = offering.credits;
          const load = roundCredits(loads[index] + credits);
          if (load > MAX_CR || prerequisiteNotes(course, evaluation.before.get(terms[index])!, evaluation.confirmed).some(note => note.blocked)) continue;
          const benefit = specific.reduce((score, rule, i) => score +
            impact(rule, course, credits) * weights[i] * (rule.unit === "courses" ? 3 : 1), 0);
          const neededFirst = (unlock.get(course.code) ?? 0) > index;
          const recognized = recognizedContribution(course, credits, liberalRoom);
          const towardTotal = total ? Math.min(total.remaining, recognized) : 0;
          if (!benefit && !neededFirst && !(hasTotal ? towardTotal > 0 : load <= semesters[index].target && recognized > 0)) continue;

          const overTarget = Math.max(0, load - semesters[index].target);
          const preference = 4 - overTarget * (strategy >= 2 ? 0.35 : 0.7) - loads[index] * 0.07;
          const phase = benefit > 0 ? 200 + 12 * benefit / Math.pow(Math.max(1, credits), [0.55, 0.8, 0.95, 1.15][strategy])
            : neededFirst ? (strategy >= 2 ? 210 : 170) : 0;
          const filler = isLiberal(course) ? 18 - Math.min(6, areas.get(area(course)) ?? 0)
            : isMajor(course) ? 0 : 11;
          const professional = specific.some(rule => rule.code.startsWith("professional") && rule.accepts(course));
          const score = phase + preference + (neededFirst ? 12 : 0) + (offering.estimated ? 0 : 2) +
            (benefit || neededFirst ? (division === "전공필수" ? 0.4 : 0) : filler) +
            towardTotal * 0.5 - Math.max(0, credits - towardTotal) * (benefit ? 0.1 : 0.6) -
            index * (professional ? 0.8 : strategy >= 2 ? 0.5 : 0.12) -
            (slots.length - 1) * (strategy >= 2 ? 2 : 0.22);
          if (!pick || score > pick.score) pick = { course, index, credits, score };
        }
      }
      if (!pick) return semesters;
      semesters[pick.index].courses.push({ code: pick.course.code, name: pick.course.name,
        category: categoryName(pick.course), credits: pick.credits });
    }
  }

  function quality(semesters: Semester[]) {
    const evaluation = evaluatePlan(roadmap, semesters);
    const gaps = requirementPlans(roadmap, evaluation.accepted).filter(rule => rule.remaining > 0);
    const specific = gaps.filter(rule => rule.type !== "total_credits");
    const major = evaluation.accepted.filter(row => row.code && isMajor(known.get(row.code)!));
    return [
      specific.length,
      specific.reduce((sum, rule) => sum + rule.remaining * (rule.unit === "courses" ? 3 : 1), 0),
      gaps.find(rule => rule.type === "total_credits")?.remaining ?? 0,
      evaluation.issues.length,
      creditsOf(major),
      creditsOf(evaluation.accepted),
      semesters.reduce((sum, semester) => sum + Math.abs(semester.target - creditsOf(semester.courses)), 0),
    ];
  }

  const plans = [0, 1, 2, 3].map(strategy => {
    const semesters = build(strategy);
    return { semesters, quality: quality(semesters) };
  });
  plans.sort((left, right) => {
    for (const [index, score] of left.quality.entries()) {
      if (score !== right.quality[index]) return score - right.quality[index];
    }
    return 0;
  });
  return plans[0].semesters;
}

export function newRoad(list: Road[], semesters: Semester[]): Road {
  const at = Date.now();
  const base = `${formatDate(at)} 로드맵`;
  let name = base;
  for (let index = 2; list.some(item => item.name === name); index++) name = `${base} ${index}`;
  return { id: crypto.randomUUID(), name, at, semesters };
}

export const formatDate = (at: number) => new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(at);
const empty: Roads = { list: [], main: null };
const saved = new Map<string, { raw: string | null; value: Roads }>();
const roadChange = "sipyeong-roadmaps";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(roadChange, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(roadChange, listener); };
}
function readRoads(key: string) {
  const previous = saved.get(key);
  try {
    const raw = localStorage.getItem(key);
    if (previous?.raw === raw) return previous.value;
    const value = raw ? JSON.parse(raw) as Roads : empty;
    saved.set(key, { raw, value });
    return value;
  } catch {
    return previous?.value ?? empty;
  }
}
export function useRoads(userId: string) {
  const key = `sipyeong-roadmaps:v2:${userId}`;
  const roads = useSyncExternalStore(subscribe, () => readRoads(key), () => empty);
  function update(change: (next: Roads) => void) {
    const next = structuredClone(readRoads(key));
    change(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(roadChange));
      return true;
    } catch {
      return false;
    }
  }
  return [roads, update] as const;
}
