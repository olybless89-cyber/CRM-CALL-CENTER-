import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { TenantsService } from './tenants.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@ApiTags('tenants')
@Controller({ path: 'tenants', version: '1' })
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_READ)
  getCurrentTenant(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getCurrentTenant(tenantId);
  }

  @Patch('me/organization')
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_UPDATE)
  updateOrganization(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.tenantsService.updateOrganization(tenantId, user.id, dto);
  }

  @Get('me/audit-logs')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  getAuditLogs(@CurrentTenant() tenantId: string, @Query('limit') limit?: string) {
    return this.tenantsService.getAuditLogs(tenantId, limit ? parseInt(limit, 10) : undefined);
  }
}
