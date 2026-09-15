import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

interface RequestWithAuth {
  user?: AuthenticatedUser;
  tenantId?: string;
}

/**
 * Resolves the tenant context strictly from the authenticated user
 * (itself derived from the verified JWT by JwtStrategy) and attaches it
 * to the request as `request.tenantId`. This is the ONLY place tenant
 * id should be read from for scoping queries — never from request
 * body/query/params. See ADR-0002.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.user?.tenantId) {
      throw new ForbiddenException('No tenant context could be resolved for this request.');
    }
    request.tenantId = request.user.tenantId;
    return true;
  }
}
