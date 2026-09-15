import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const CACHE_TTL_SECONDS = 30;

/**
 * Resolves a user's effective permission set for a tenant by walking
 * UserRole -> Role -> RolePermission -> Permission. Result is cached
 * briefly in Redis (see ADR-0005) — Redis is a cache here, never the
 * source of truth.
 */
@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private cacheKey(userId: string, tenantId: string): string {
    return `rbac:effective-permissions:${tenantId}:${userId}`;
  }

  async getEffectivePermissions(userId: string, tenantId: string): Promise<Set<string>> {
    const cached = await this.redis.get(this.cacheKey(userId, tenantId));
    if (cached) {
      return new Set(JSON.parse(cached) as string[]);
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, tenantId },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });

    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    await this.redis.set(
      this.cacheKey(userId, tenantId),
      JSON.stringify([...permissions]),
      CACHE_TTL_SECONDS,
    );
    return permissions;
  }

  async invalidateCache(userId: string, tenantId: string): Promise<void> {
    await this.redis.del(this.cacheKey(userId, tenantId));
  }

  async assignRole(params: {
    userId: string;
    roleKey: string;
    tenantId: string;
    assignedByUserId?: string;
  }) {
    const role = await this.prisma.role.findUnique({ where: { key: params.roleKey } });
    if (!role) {
      throw new Error(`Unknown role key: ${params.roleKey}`);
    }
    const userRole = await this.prisma.userRole.upsert({
      where: {
        userId_roleId_tenantId: {
          userId: params.userId,
          roleId: role.id,
          tenantId: params.tenantId,
        },
      },
      update: {},
      create: {
        userId: params.userId,
        roleId: role.id,
        tenantId: params.tenantId,
        assignedByUserId: params.assignedByUserId,
      },
    });
    await this.invalidateCache(params.userId, params.tenantId);
    return userRole;
  }

  listRoles() {
    return this.prisma.role.findMany({
      where: { isSystem: true },
      select: { id: true, key: true, name: true, description: true },
    });
  }
}
