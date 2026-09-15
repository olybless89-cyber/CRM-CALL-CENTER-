/**
 * Seeds the fixed system permission and role catalog described in the
 * engineering brief. Idempotent (safe to re-run) — uses upserts keyed on
 * the unique `key` column.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma-client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PERMISSIONS = [
  ['tenants:create', 'Create a new tenant'],
  ['tenants:read', 'View tenant details'],
  ['tenants:update', 'Update tenant settings'],
  ['tenants:delete', 'Delete/cancel a tenant'],
  ['organizations:read', 'View organization/workspace profile'],
  ['organizations:update', 'Update organization/workspace profile'],
  ['users:create', 'Create users within a tenant'],
  ['users:read', 'View users within a tenant'],
  ['users:update', 'Update users within a tenant'],
  ['users:delete', 'Deactivate/delete users within a tenant'],
  ['roles:read', 'View roles and permissions'],
  ['roles:assign', 'Assign or revoke roles from users'],
  ['permissions:read', 'View the permission catalog'],
  ['audit:read', 'View audit log entries'],
] as const;

const ROLES: Array<{
  key: string;
  name: string;
  description: string;
  permissions: string[];
}> = [
  {
    key: 'platform_owner',
    name: 'Platform Owner',
    description: 'Full control of the platform across all tenants.',
    permissions: PERMISSIONS.map(([key]) => key),
  },
  {
    key: 'platform_admin',
    name: 'Platform Admin',
    description: 'Platform-wide administration, excluding tenant deletion.',
    permissions: PERMISSIONS.map(([key]) => key).filter((k) => k !== 'tenants:delete'),
  },
  {
    key: 'tenant_owner',
    name: 'Tenant Owner',
    description: 'Full control within a single tenant.',
    permissions: [
      'organizations:read',
      'organizations:update',
      'users:create',
      'users:read',
      'users:update',
      'users:delete',
      'roles:read',
      'roles:assign',
      'permissions:read',
      'audit:read',
    ],
  },
  {
    key: 'tenant_admin',
    name: 'Tenant Admin',
    description: 'Day-to-day administration within a tenant.',
    permissions: [
      'organizations:read',
      'users:create',
      'users:read',
      'users:update',
      'roles:read',
      'roles:assign',
      'audit:read',
    ],
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Manages teams within a tenant.',
    permissions: ['organizations:read', 'users:read', 'audit:read'],
  },
  {
    key: 'supervisor',
    name: 'Supervisor',
    description: 'Supervises agents within a tenant.',
    permissions: ['organizations:read', 'users:read'],
  },
  {
    key: 'agent',
    name: 'Agent',
    description: 'Contact center agent.',
    permissions: ['organizations:read'],
  },
  {
    key: 'sales',
    name: 'Sales',
    description: 'Sales pipeline user.',
    permissions: ['organizations:read'],
  },
  {
    key: 'support',
    name: 'Support',
    description: 'Support desk user.',
    permissions: ['organizations:read'],
  },
  {
    key: 'read_only',
    name: 'Read Only',
    description: 'Read-only access within a tenant.',
    permissions: ['organizations:read', 'users:read'],
  },
];

async function main() {
  console.log('Seeding permissions...');
  const permissionRecords = await Promise.all(
    PERMISSIONS.map(([key, description]) =>
      prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      }),
    ),
  );
  const permissionIdByKey = new Map(permissionRecords.map((p) => [p.key, p.id]));

  console.log('Seeding system roles...');
  for (const role of ROLES) {
    const roleRecord = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, isSystem: true },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true,
        tenantId: null,
      },
    });

    for (const permissionKey of role.permissions) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: roleRecord.id, permissionId },
        },
        update: {},
        create: { roleId: roleRecord.id, permissionId },
      });
    }
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
