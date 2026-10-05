import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ChecklistsModule } from './modules/checklists/checklists.module';
import { ClassroomsModule } from './modules/classrooms/classrooms.module';
import { ExamsModule } from './modules/exams/exams.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DatabaseModule } from './common/database.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ClassroomsModule,
    ExamsModule,
    ChecklistsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
