import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../common/auth.types';
import { DatabaseService } from '../../common/database.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async list(user: AuthUser) {
    const result = await this.database.query(
      `SELECT id, exam_id, title, message, read_at, created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [user.id],
    );
    return result.rows;
  }

  async markRead(user: AuthUser, notificationId: string) {
    const result = await this.database.query(
      `UPDATE notifications SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING id, exam_id, title, message, read_at, created_at`,
      [notificationId, user.id],
    );
    if (!result.rowCount) throw new NotFoundException('Notificacao nao encontrada.');
    return result.rows[0];
  }
}