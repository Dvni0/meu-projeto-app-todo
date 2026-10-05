import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { verify } from 'jsonwebtoken';
import { AuthUser } from './auth.types';

type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    const secret = process.env.JWT_SECRET;

    if (!token || !secret) {
      throw new UnauthorizedException('Token de acesso obrigatorio.');
    }

    try {
      const payload = verify(token, secret);
      if (typeof payload === 'string' || !payload.sub) {
        throw new Error('Invalid token payload');
      }
      request.user = {
        id: payload.sub,
        name: String(payload.name),
        email: String(payload.email),
        role: payload.role as AuthUser['role'],
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado.');
    }
  }
}