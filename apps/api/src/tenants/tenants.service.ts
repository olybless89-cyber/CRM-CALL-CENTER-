import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Every read here is scoped by the tenantId resolved from the
   * authenticated request (TenantContextGuard) — never by a value from
   * the request. See ADR-0002.
   */
  async getCurrentTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { organization: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }
    return tenant;
  }

  async updateOrganization(tenantId: string, actorUserId: string, dto: UpdateOrganizationDto) {
    const organization = await this.prisma.organization.update({
      where: { tenantId },
      data: dto,
    });

    await this.auditService.record({
      tenantId,
      actorUserId,
      action: 'organization.updated',
      entityType: 'Organization',
      entityId: organization.id,
      metadata: dto,
    });

    return organization;
  }

  async getAuditLogs(tenantId: string, limit = 50) {
    return this.auditService.findForTenant(tenantId, limit);
  }
}
