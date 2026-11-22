import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GradesController } from '../grades/grades.controller';
import { GradesStore } from '../grades/grades.store';
import { AcademicsController } from './academics.controller';
import { AcademicsService } from './academics.service';
import { AcademicsStore } from './academics.store';

@Module({
  imports: [AuthModule],
  controllers: [AcademicsController, GradesController],
  providers: [AcademicsService, AcademicsStore, GradesStore],
})
export class AcademicsModule {}
