import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthUser } from '../../common/auth.types';
import { DatabaseService } from '../../common/database.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@Injectable()
export class ChecklistsService {
  constructor(private readonly database: DatabaseService) {}

  async list(user: AuthUser, examId?: string) {
    this.requireStudent(user);
    const values: unknown[] = [user.id];
    const examFilter = examId ? `AND item.exam_id = $${values.push(examId)}` : '';
    const result = await this.database.query(
      `SELECT item.id, item.exam_id, item.title, item.is_completed,
              item.created_at, item.updated_at, exam.title AS exam_title
       FROM checklists item JOIN exams exam ON exam.id = item.exam_id
       WHERE item.student_id = $1 ${examFilter}
       ORDER BY item.created_at, item.id`,
      values,
    );
    return result.rows;
  }

  async create(user: AuthUser, dto: CreateChecklistItemDto) {
    this.requireStudent(user);
    const result = await this.database.query(
      `INSERT INTO checklists (id, student_id, exam_id, title)
       SELECT $1, $2, exam.id, $3 FROM exams exam
       JOIN classroom_members member ON member.classroom_id = exam.classroom_id
       WHERE exam.id = $4 AND member.student_id = $2
       RETURNING id, student_id, exam_id, title, is_completed, created_at, updated_at`,
      [randomUUID(), user.id, dto.title.trim(), dto.examId],
    );
    if (!result.rowCount) {
      throw new NotFoundException('Avaliacao nao encontrada ou sem acesso.');
    }
    return result.rows[0];
  }

  async update(user: AuthUser, itemId: string, dto: UpdateChecklistItemDto) {
    this.requireStudent(user);
    const assignments: string[] = [];
    const values: unknown[] = [itemId, user.id];
    if (dto.title !== undefined) {
      values.push(dto.title.trim());
      assignments.push(`title = $${values.length}`);
    }
    if (dto.isCompleted !== undefined) {
      values.push(dto.isCompleted);
      assignments.push(`is_completed = $${values.length}`);
    }
    if (!assignments.length) throw new NotFoundException('Nenhuma alteracao informada.');
    assignments.push('updated_at = NOW()');
    const result = await this.database.query(
      `UPDATE checklists SET ${assignments.join(', ')}
       WHERE id = $1 AND student_id = $2
       RETURNING id, exam_id, title, is_completed, created_at, updated_at`,
      values,
    );
    if (!result.rowCount) throw new NotFoundException('Item de checklist nao encontrado.');
    return result.rows[0];
  }

  async remove(user: AuthUser, itemId: string) {
    this.requireStudent(user);
    const result = await this.database.query(
      'DELETE FROM checklists WHERE id = $1 AND student_id = $2 RETURNING id',
      [itemId, user.id],
    );
    if (!result.rowCount) throw new NotFoundException('Item de checklist nao encontrado.');
    return { id: itemId, deleted: true };
  }

  private requireStudent(user: AuthUser): void {
    if (user.role !== 'student') {
      throw new ForbiddenException('Checklist de estudo e exclusivo para alunos.');
    }
  }
}