import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentInfoController } from './student-info.controller';
import { StudentInfoStore } from './student-info.store';

@Module({
  imports: [AuthModule],
  controllers: [StudentInfoController],
  providers: [StudentInfoStore],
})
export class StudentInfoModule {}
