import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { RbacService } from '../../rbac/rbac.service';

interface RequestWithAuth {
  user?: AuthenticatedUser;
  tenantId?: string;
}

/**
 * Enforces @RequirePermissions() on a route by loading the current
 * user's effective permissions (role -> permission, cached briefly in
 * Redis by RbacService) for the resolved tenant context.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }

    const effectivePermissions = await this.rbacService.getEffectivePermissions(
      user.id,
      request.tenantId ?? user.tenantId,
    );

    const hasAll = required.every((permission) => effectivePermissions.has(permission));
    if (!hasAll) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    return true;
  }
}
