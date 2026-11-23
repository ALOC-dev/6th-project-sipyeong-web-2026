import { Injectable } from '@nestjs/common';
import { OverviewStore } from './overview.store';
import { calculateOverview } from './overview.calculator';
import { currentAcademicTerm, currentSubmissionTerm } from '../common/academic-term';
import { summarizeGradeTotals } from '../grades/grade-summary';

@Injectable()
export class OverviewService {
  constructor(private readonly store: OverviewStore) {}
  async summary(userId: string) {
    const now = new Date();
    const academicTerm = currentAcademicTerm(now);
    const [input, termCalendar] = await Promise.all([this.store.load(userId), this.store.calendar(academicTerm)]);
    return { ...calculateOverview(input, currentSubmissionTerm(now)), calendar: { academicTerm, ...termCalendar } };
  }
  async graduation(userId: string) {
    const overview = calculateOverview(await this.store.load(userId), currentSubmissionTerm());
    return { profile: overview.profile, currentTerm: overview.currentTerm,
      gpa: overview.gpa, credits: overview.credits, ...overview.graduation };
  }
  async roadmap(userId: string) {
    const term = currentSubmissionTerm();
    const input = await this.store.load(userId);
    const overview = calculateOverview(input, term);
    const termRank: Record<string, number> = { '10': 1, SUMMER: 2, '20': 3, WINTER: 4 };
    const enrolled = input.records.filter(row => row.status === 'enrolled' && row.year === term.year && row.term_code === term.termCode);
    const completed = input.records.filter(row => {
      if (row.status !== 'completed' || !(row.term_code in termRank) || row.year > term.year ||
          (row.year === term.year && termRank[row.term_code] > termRank[term.termCode])) return false;
      // A passed zero-credit course can still be a prerequisite.
      return (summarizeGradeTotals([{
        recordId: row.record_id, credits: 1, grade: row.grade, gradeValid: row.grade_valid, status: row.status,
      }]).earnedCredits ?? 0) > 0;
    });
    const catalog = input.profile ? await this.store.roadmapCatalog(
      input.profile.department_id, input.profile.admission_year, term,
      [...new Set(input.requirements.flatMap(rule => rule.courses.map(course => course.course_id)))],
    ) : [];
    return {
      currentTerm: term, gpa: overview.gpa, semesterGpas: overview.semesterGpas,
      earnedCredits: overview.credits.earned, projectedCredits: overview.credits.projected,
      currentCredits: overview.currentSemester.credits, graduation: overview.graduation, catalog,
      recognition: overview.credits.recognition,
      completed: completed.map(row => row.catalog_course_number ?? row.course_number_snapshot),
      enrolled: enrolled.map(row => ({
        code: row.catalog_course_number ?? row.course_number_snapshot, name: row.course_name_snapshot,
        category: row.category_snapshot, credits: Number(row.credits),
      })),
      hasRecords: input.records.length > 0,
    };
  }
}
