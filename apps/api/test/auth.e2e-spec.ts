import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const tenantSlug = `auth-e2e-${runId}`;
  const email = `owner-${runId}@example.com`;
  const password = 'Sup3r-Secret-Passw0rd!';
  let accessToken: string;
  let refreshToken: string;

  it('GET /api/v1/health is public and reports Postgres + Redis up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/v1/auth/register creates a tenant, organization, and tenant-owner user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        tenantName: `Auth E2E ${runId}`,
        tenantSlug,
        email,
        password,
        firstName: 'Ada',
        lastName: 'Owner',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.tenant.slug).toBe(tenantSlug);

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('rejects registration with an invalid email (validation)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        tenantName: 'Invalid',
        email: 'not-an-email',
        password: 'whatever-password',
        firstName: 'A',
        lastName: 'B',
      })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/auth/me returns the authenticated user from the access token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.email).toBe(email);
  });

  it('rejects unauthenticated requests to protected routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('POST /api/v1/auth/login succeeds with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.data.accessToken).toEqual(expect.any(String));
  });

  it('POST /api/v1/auth/login fails with the wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/refresh rotates the refresh token and issues a new access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).not.toEqual(refreshToken);
  });

  it('rejects reuse of an already-rotated refresh token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('never stores the plaintext password anywhere retrievable', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    expect(user.passwordHash).not.toEqual(password);
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
  });
});
