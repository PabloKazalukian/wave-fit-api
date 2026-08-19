import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { verify } from 'jsonwebtoken';

export interface ServiceJwtPayload {
  sub: string;
  role: 'SERVICE';
  scope: string[];
  iat: number;
  exp: number;
}

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret =
      this.configService.get<string>('JWT_SECRET') || 'supersecretkey';
  }

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;

    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing service token');
    }

    try {
      const decoded = verify(token, this.secret) as ServiceJwtPayload;

      if (decoded.role !== 'SERVICE') {
        throw new UnauthorizedException('Invalid service token role');
      }

      req.serviceUser = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired service token');
    }
  }

  private extractToken(req: any): string | null {
    const authHeader = req?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }
}
