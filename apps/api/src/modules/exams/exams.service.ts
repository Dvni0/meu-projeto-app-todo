import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthUser } from '../../common/auth.types';
import { DatabaseService } from '../../common/database.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { ExamFiltersDto } from './dto/exam-filters.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

export interface ExamRow {
  id: string;
  classroom_id: string;
  title: string;
  starts_at: string;
  weight: string;
  content: string;
  materials: Array<{ title: string; url: string }>;
  status: 'scheduled' | 'cancelled';
}

@Injectable()
export class ExamsService {
  constructor(private readonly database: DatabaseService) {}

  async list(user: AuthUser, filters: ExamFiltersDto) {
    const conditions = [
      user.role === 'teacher' ? 'c.teacher_id = $1' : 'cm.student_id = $1',
    ];
    const values: unknown[] = [user.id];
    const addFilter = (condition: string, value: unknown) => {
      values.push(value);
      conditions.push(condition.replace('?', `$${values.length}`));
    };

    if (filters.classroomId) addFilter('e.classroom_id = ?', filters.classroomId);
    if (filters.status) addFilter('e.status = ?', filters.status);
    if (filters.from) addFilter('e.starts_at >= ?', filters.from);
    if (filters.to) addFilter('e.starts_at <= ?', filters.to);
    if (filters.search) {
      values.push(`%${filters.search.trim()}%`);
      conditions.push(`(e.title ILIKE $${values.length} OR e.content ILIKE $${values.length})`);
    }

    const membershipJoin =
      user.role === 'student'
        ? 'JOIN classroom_members cm ON cm.classroom_id = e.classroom_id'
        : '';
    const result = await this.database.query(
      `SELECT e.*, c.name AS classroom_name, c.subject, u.name AS teacher_name
       FROM exams e JOIN classrooms c ON c.id = e.classroom_id
       JOIN users u ON u.id = c.teacher_id ${membershipJoin}
       WHERE ${conditions.join(' AND ')} ORDER BY e.starts_at ASC`,
      values,
    );
    return result.rows;
  }

  async get(user: AuthUser, examId: string) {
    const permission =
      user.role === 'teacher'
        ? 'c.teacher_id = $2'
        : 'EXISTS (SELECT 1 FROM classroom_members cm WHERE cm.classroom_id = c.id AND cm.student_id = $2)';
    const result = await this.database.query<ExamRow>(
      `SELECT e.*, c.name AS classroom_name, c.subject, u.name AS teacher_name
       FROM exams e JOIN classrooms c ON c.id = e.classroom_id
       JOIN users u ON u.id = c.teacher_id
       WHERE e.id = $1 AND ${permission}`,
      [examId, user.id],
    );
    if (!result.rows[0]) throw new NotFoundException('Avaliacao nao encontrada.');
    return result.rows[0];
  }

  async create(user: AuthUser, dto: CreateExamDto) {
    this.requireTeacher(user);
    const classroom = await this.database.query(
      'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [dto.classroomId, user.id],
    );
    if (!classroom.rowCount) throw new NotFoundException('Turma nao encontrada.');

    const result = await this.database.query<ExamRow>(
      `INSERT INTO exams (id, classroom_id, creator_id, title, starts_at, weight, content, materials)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        randomUUID(),
        dto.classroomId,
        user.id,
        dto.title.trim(),
        dto.startsAt,
        dto.weight ?? 1,
        dto.content?.trim() ?? '',
        JSON.stringify(dto.materials ?? []),
      ],
    );
    await this.notifyStudents(
      dto.classroomId,
      result.rows[0].id,
      'Nova avaliacao',
      `${dto.title.trim()} foi adicionada a turma.`,
    );
    return result.rows[0];
  }

  async update(user: AuthUser, examId: string, dto: UpdateExamDto) {
    this.requireTeacher(user);
    const exam = await this.get(user, examId);
    const fields: Array<[keyof UpdateExamDto, string, unknown]> = [
      ['title', 'title', dto.title?.trim()],
      ['startsAt', 'starts_at', dto.startsAt],
      ['weight', 'weight', dto.weight],
      ['content', 'content', dto.content?.trim()],
      ['materials', 'materials', dto.materials ? JSON.stringify(dto.materials) : undefined],
      ['status', 'status', dto.status],
    ];
    const assignments: string[] = [];
    const values: unknown[] = [examId];
    for (const [key, column, value] of fields) {
      if (dto[key] === undefined) continue;
      values.push(value);
      assignments.push(`${column} = $${values.length}${key === 'materials' ? '::jsonb' : ''}`);
    }
    if (assignments.length) {
      assignments.push('updated_at = NOW()');
      await this.database.query(
        `UPDATE exams SET ${assignments.join(', ')} WHERE id = $1`,
        values,
      );
      const eventTitle = dto.status === 'cancelled' ? 'Avaliacao cancelada' : 'Avaliacao atualizada';
      await this.notifyStudents(
        exam.classroom_id,
        examId,
        eventTitle,
        `${dto.title?.trim() ?? exam.title} teve suas informacoes alteradas.`,
      );
    }
    return this.get(user, examId);
  }

  async cancel(user: AuthUser, examId: string) {
    this.requireTeacher(user);
    const exam = await this.get(user, examId);
    if (exam.status !== 'cancelled') {
      await this.database.query(
        "UPDATE exams SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
        [examId],
      );
      await this.notifyStudents(
        exam.classroom_id,
        examId,
        'Avaliacao cancelada',
        `${exam.title} foi cancelada.`,
      );
    }
    return { id: examId, status: 'cancelled' };
  }

  private async notifyStudents(
    classroomId: string,
    examId: string,
    title: string,
    message: string,
  ): Promise<void> {
    const students = await this.database.query<{ student_id: string }>(
      'SELECT student_id FROM classroom_members WHERE classroom_id = $1',
      [classroomId],
    );
    for (const { student_id: studentId } of students.rows) {
      await this.database.query(
        `INSERT INTO notifications (id, user_id, exam_id, title, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), studentId, examId, title, message],
      );
    }
  }

  private requireTeacher(user: AuthUser): void {
    if (user.role !== 'teacher') {
      throw new ForbiddenException('Esta acao e exclusiva para professores.');
    }
  }
}