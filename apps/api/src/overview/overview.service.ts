import { Injectable } from '@nestjs/common';
import { OverviewStore } from './overview.store';
import { calculateOverview } from './overview.calculator';
import { currentSubmissionTerm } from '../common/academic-term';

@Injectable()
export class OverviewService {
  constructor(private readonly store: OverviewStore) {}
  async summary(userId: string) {
    return calculateOverview(await this.store.load(userId), currentSubmissionTerm());
  }
  async graduation(userId: string) {
    const overview = await this.summary(userId);
    return { profile: overview.profile, currentTerm: overview.currentTerm,
      gpa: overview.gpa, credits: overview.credits, ...overview.graduation };
  }
}
