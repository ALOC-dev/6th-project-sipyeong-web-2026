import { Injectable } from '@nestjs/common';
import { OverviewStore } from './overview.store';
import { calculateOverview } from './overview.calculator';
import { currentAcademicTerm, currentSubmissionTerm } from '../common/academic-term';

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
}
