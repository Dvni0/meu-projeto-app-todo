import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuthUser } from '../../common/auth.types';
import { DatabaseService } from '../../common/database.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';

@Injectable()
export class ClassroomsService {
  constructor(private readonly database: DatabaseService) {}

  async create(user: AuthUser, dto: CreateClassroomDto) {
    this.requireTeacher(user);
    const joinCode = randomBytes(4).toString('hex').toUpperCase();
    const result = await this.database.query(
      `INSERT INTO classrooms (id, name, subject, join_code, teacher_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, subject, join_code, teacher_id, created_at`,
      [randomUUID(), dto.name.trim(), dto.subject.trim(), joinCode, user.id],
    );
    return result.rows[0];
  }

  async list(user: AuthUser) {
    const result =
      user.role === 'teacher'
        ? await this.database.query(
            `SELECT c.id, c.name, c.subject, c.join_code, c.teacher_id, c.created_at,
                    COUNT(cm.student_id)::int AS student_count
             FROM classrooms c LEFT JOIN classroom_members cm ON cm.classroom_id = c.id
             WHERE c.teacher_id = $1 GROUP BY c.id ORDER BY c.created_at DESC`,
            [user.id],
          )
        : await this.database.query(
            `SELECT c.id, c.name, c.subject, c.teacher_id, c.created_at,
                    u.name AS teacher_name
             FROM classrooms c
             JOIN classroom_members cm ON cm.classroom_id = c.id
             JOIN users u ON u.id = c.teacher_id
             WHERE cm.student_id = $1 ORDER BY c.name`,
            [user.id],
          );
    return result.rows;
  }

  async join(user: AuthUser, code: string) {
    if (user.role !== 'student') {
      throw new ForbiddenException('Somente alunos podem ingressar em turmas.');
    }
    const classroom = await this.database.query<{ id: string }>(
      'SELECT id FROM classrooms WHERE join_code = $1',
      [code.trim().toUpperCase()],
    );
    if (!classroom.rows[0]) {
      throw new NotFoundException('Codigo de turma nao encontrado.');
    }
    await this.database.query(
      'INSERT INTO classroom_members (classroom_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [classroom.rows[0].id, user.id],
    );
    return { classroomId: classroom.rows[0].id, joined: true };
  }

  async members(user: AuthUser, classroomId: string) {
    this.requireTeacher(user);
    const result = await this.database.query(
      `SELECT u.id, u.name, u.email, cm.joined_at
       FROM classroom_members cm JOIN users u ON u.id = cm.student_id
       JOIN classrooms c ON c.id = cm.classroom_id
       WHERE cm.classroom_id = $1 AND c.teacher_id = $2 ORDER BY u.name`,
      [classroomId, user.id],
    );
    const ownsClassroom = await this.database.query(
      'SELECT 1 FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroomId, user.id],
    );
    if (!ownsClassroom.rowCount) {
      throw new NotFoundException('Turma nao encontrada.');
    }
    return result.rows;
  }

  private requireTeacher(user: AuthUser): void {
    if (user.role !== 'teacher') {
      throw new ForbiddenException('Esta acao e exclusiva para professores.');
    }
  }
}