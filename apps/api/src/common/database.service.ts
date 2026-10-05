import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/academic_planner',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          name VARCHAR(120) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS classrooms (
          id UUID PRIMARY KEY,
          name VARCHAR(120) NOT NULL,
          subject VARCHAR(120) NOT NULL,
          join_code VARCHAR(12) NOT NULL UNIQUE,
          teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS classroom_members (
          classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
          student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (classroom_id, student_id)
        );
        CREATE TABLE IF NOT EXISTS exams (
          id UUID PRIMARY KEY,
          classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
          creator_id UUID NOT NULL REFERENCES users(id),
          title VARCHAR(160) NOT NULL,
          starts_at TIMESTAMPTZ NOT NULL,
          weight NUMERIC(5, 2) NOT NULL DEFAULT 1 CHECK (weight > 0),
          content TEXT NOT NULL DEFAULT '',
          materials JSONB NOT NULL DEFAULT '[]'::jsonb,
          status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS checklists (
          id UUID PRIMARY KEY,
          student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
          title VARCHAR(180) NOT NULL,
          is_completed BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
          title VARCHAR(160) NOT NULL,
          message TEXT NOT NULL,
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS exams_classroom_starts_at_idx ON exams(classroom_id, starts_at);
        CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx ON notifications(user_id, created_at DESC);
      `);
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'PostgreSQL indisponivel. Inicie o banco com `docker compose up -d` ou confira DATABASE_URL.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, values as never[]);
  }
}