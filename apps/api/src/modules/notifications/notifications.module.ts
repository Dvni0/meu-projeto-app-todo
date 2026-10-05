import { Module } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, AuthGuard],
})
export class NotificationsModule {}