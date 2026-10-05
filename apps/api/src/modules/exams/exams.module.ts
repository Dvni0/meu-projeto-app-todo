import { Module } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({ controllers: [ExamsController], providers: [ExamsService, AuthGuard] })
export class ExamsModule {}