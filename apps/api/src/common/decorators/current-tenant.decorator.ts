import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithTenant {
  tenantId?: string;
}

/**
 * Extracts the tenant id resolved by TenantContextGuard from the verified
 * JWT. Never trust a tenant id read directly from the request body/query.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithTenant>();
    return request.tenantId;
  },
);
