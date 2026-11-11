import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfileController } from './profile.controller';
import { ProfileStore } from './profile.store';

@Module({ imports: [AuthModule], controllers: [ProfileController], providers: [ProfileStore] })
export class ProfileModule {}
