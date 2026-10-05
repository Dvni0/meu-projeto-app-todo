import { Module } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { ChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

@Module({
  controllers: [ChecklistsController],
  providers: [ChecklistsService, AuthGuard],
})
export class ChecklistsModule {}