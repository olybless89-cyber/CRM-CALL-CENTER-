import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { PasswordService } from '../auth/password.service';
import { SYSTEM_ROLES } from '../rbac/permissions.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly rbacService: RbacService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Every query below is filtered by `tenantId` taken from the caller
   * (which itself must come from TenantContextGuard / the verified JWT).
   * This is the enforcement point proven by
   * test/tenant-isolation.e2e-spec.ts.
   */
  listForTenant(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getForTenant(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  async createForTenant(tenantId: string, actorUserId: string, dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) {
      throw new ConflictException('A user with that email already exists in this tenant.');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    await this.rbacService.assignRole({
      userId: user.id,
      roleKey: dto.roleKey ?? SYSTEM_ROLES.AGENT,
      tenantId,
      assignedByUserId: actorUserId,
    });

    await this.auditService.record({
      tenantId,
      actorUserId,
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
    });

    return this.getForTenant(tenantId, user.id);
  }

  async updateForTenant(tenantId: string, actorUserId: string, userId: string, dto: UpdateUserDto) {
    // Confirms the user belongs to this tenant before writing anything.
    await this.getForTenant(tenantId, userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    await this.auditService.record({
      tenantId,
      actorUserId,
      action: 'user.updated',
      entityType: 'User',
      entityId: userId,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return this.getForTenant(tenantId, user.id);
  }

  async deactivateForTenant(tenantId: string, actorUserId: string, userId: string) {
    await this.getForTenant(tenantId, userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'INACTIVE' },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      tenantId,
      actorUserId,
      action: 'user.deactivated',
      entityType: 'User',
      entityId: userId,
    });

    return { deactivated: true };
  }

  async listRoles(tenantId: string, userId: string) {
    await this.getForTenant(tenantId, userId);
    return this.prisma.userRole.findMany({
      where: { userId, tenantId },
      include: { role: { select: { key: true, name: true } } },
    });
  }

  async assignRole(tenantId: string, actorUserId: string, userId: string, roleKey: string) {
    await this.getForTenant(tenantId, userId);
    const userRole = await this.rbacService.assignRole({
      userId,
      roleKey,
      tenantId,
      assignedByUserId: actorUserId,
    });

    await this.auditService.record({
      tenantId,
      actorUserId,
      action: 'user.role_assigned',
      entityType: 'User',
      entityId: userId,
      metadata: { roleKey },
    });

    return userRole;
  }
}
