import { Module } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { ClassroomsController } from './classrooms.controller';
import { ClassroomsService } from './classrooms.service';

@Module({
  controllers: [ClassroomsController],
  providers: [ClassroomsService, AuthGuard],
})
export class ClassroomsModule {}