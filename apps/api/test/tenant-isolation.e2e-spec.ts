import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';

/**
 * Proves the central security requirement of the platform (see
 * ADR-0002 and the architecture README): a user authenticated as
 * Tenant A can never read or mutate Tenant B's data, regardless of
 * what tenant id the client claims via body, query, or headers.
 */
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerTenant(label: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        tenantName: `Isolation ${label} ${runId}`,
        tenantSlug: `isolation-${label}-${runId}`,
        email: `${label}-${runId}@example.com`,
        password: 'Sup3r-Secret-Passw0rd!',
        firstName: label,
        lastName: 'Owner',
      })
      .expect(201);

    return {
      accessToken: res.body.data.accessToken as string,
      tenantId: res.body.data.tenant.id as string,
      userId: res.body.data.user.id as string,
    };
  }

  let tenantA: { accessToken: string; tenantId: string; userId: string };
  let tenantB: { accessToken: string; tenantId: string; userId: string };
  let tenantAExtraUserId: string;

  beforeAll(async () => {
    tenantA = await registerTenant('tenant-a');
    tenantB = await registerTenant('tenant-b');

    // Give Tenant A a second user so there is something for Tenant B to
    // (unsuccessfully) try to reach.
    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tenantA.accessToken}`)
      .send({
        email: `agent-${runId}@example.com`,
        password: 'Another-Secret-Passw0rd!',
        firstName: 'Agent',
        lastName: 'A',
      })
      .expect(201);

    tenantAExtraUserId = res.body.data.id;
  });

  it("Tenant A can read its own users", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tenantA.accessToken}`)
      .expect(200);

    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).toContain(tenantA.userId);
    expect(ids).toContain(tenantAExtraUserId);
  });

  it("Tenant B cannot fetch Tenant A's user by id (404, not leaked)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/users/${tenantAExtraUserId}`)
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  it("Tenant B's user list never includes Tenant A's users", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .expect(200);

    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(tenantAExtraUserId);
    expect(ids).not.toContain(tenantA.userId);
  });

  it('Tenant B cannot deactivate (DELETE) a Tenant A user', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/users/${tenantAExtraUserId}`)
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .expect(404);
  });

  it('a forged tenant header has no effect — tenant context always comes from the JWT', async () => {
    // Even if a malicious client sends a header naming Tenant A's id, the
    // TenantContextGuard never reads it; Tenant B still only sees Tenant B.
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .set('x-tenant-id', tenantA.tenantId)
      .expect(200);

    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(tenantAExtraUserId);
  });

  it("Tenant B's own tenant/organization view never exposes Tenant A's org", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .expect(200);

    expect(res.body.data.id).toBe(tenantB.tenantId);
    expect(res.body.data.id).not.toBe(tenantA.tenantId);
  });

  it('a user without the required permission is denied (RBAC enforcement)', async () => {
    // Assign the Tenant-A agent the read_only system role, stripping
    // users:create, then confirm they can no longer create users.
    await request(app.getHttpServer())
      .post(`/api/v1/users/${tenantAExtraUserId}/roles`)
      .set('Authorization', `Bearer ${tenantA.accessToken}`)
      .send({ roleKey: 'read_only' })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `agent-${runId}@example.com`, password: 'Another-Secret-Passw0rd!' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
      .send({
        email: `should-fail-${runId}@example.com`,
        password: 'Whatever-Passw0rd!',
        firstName: 'Should',
        lastName: 'Fail',
      })
      .expect(403);
  });
});
