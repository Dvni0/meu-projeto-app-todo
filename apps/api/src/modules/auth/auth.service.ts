import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { DatabaseService } from '../../common/database.service';
import { AuthUser } from '../../common/auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface UserRow extends AuthUser {
  password_hash: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async register(dto: RegisterDto) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET precisa estar configurado.');
    }

    const user: AuthUser = {
      id: randomUUID(),
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      role: dto.role,
    };

    try {
      await this.database.query(
        'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
        [user.id, user.name, user.email, await hash(dto.password, 12), user.role],
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Ja existe uma conta com este e-mail.');
      }
      throw error;
    }

    return this.createSession(user, secret);
  }

  async login(dto: LoginDto) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET precisa estar configurado.');
    }

    const result = await this.database.query<UserRow>(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
      [dto.email.trim().toLowerCase()],
    );
    const user = result.rows[0];
    if (!user || !(await compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    const { password_hash: _passwordHash, ...publicUser } = user;
    return this.createSession(publicUser, secret);
  }

  private createSession(user: AuthUser, secret: string) {
    return {
      accessToken: sign(
        { name: user.name, email: user.email, role: user.role },
        secret,
        { subject: user.id, expiresIn: '12h' },
      ),
      user,
    };
  }
}