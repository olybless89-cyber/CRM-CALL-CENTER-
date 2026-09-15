import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { SYSTEM_ROLES } from '../rbac/permissions.constants';
import { PasswordService } from './password.service';
import { generateOpaqueToken, hashToken, slugify } from './token.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
  ) {}

  private async issueTokens(
    user: { id: string; tenantId: string; email: string },
    ctx: RequestContext = {},
  ): Promise<AuthTokens> {
    const accessTtl = this.configService.get<string>('jwt.accessTtl');
    const refreshTtlDays = this.configService.get<number>('jwt.refreshTtlDays') ?? 30;

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, tenantId: user.tenantId, email: user.email },
      { expiresIn: accessTtl as JwtSignOptions['expiresIn'] },
    );

    const refreshToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtl ?? '15m' };
  }

  async register(dto: RegisterDto, ctx: RequestContext = {}) {
    const baseSlug = slugify(dto.tenantSlug ?? dto.tenantName);
    let slug = baseSlug;
    let attempt = 0;
    // Small, bounded retry on slug collision rather than failing the whole signup.
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      attempt += 1;
      if (dto.tenantSlug || attempt > 5) {
        throw new ConflictException('That tenant slug is already taken.');
      }
      slug = `${baseSlug}-${generateOpaqueToken().slice(0, 4)}`;
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, slug },
      });
      await tx.organization.create({
        data: { tenantId: tenant.id, name: dto.tenantName },
      });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
      return { tenant, user };
    });

    await this.rbacService.assignRole({
      userId: user.id,
      roleKey: SYSTEM_ROLES.TENANT_OWNER,
      tenantId: tenant.id,
    });

    await this.auditService.record({
      tenantId: tenant.id,
      actorUserId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const tokens = await this.issueTokens(
      { id: user.id, tenantId: tenant.id, email: user.email },
      ctx,
    );

    return {
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto, ctx: RequestContext = {}) {
    const email = dto.email.toLowerCase();

    let candidates: Array<{ id: string; tenantId: string }>;
    if (dto.tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
      if (!tenant) {
        throw new UnauthorizedException('Invalid credentials.');
      }
      const user = await this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email } },
      });
      candidates = user ? [user] : [];
    } else {
      candidates = await this.prisma.user.findMany({ where: { email } });
      if (candidates.length > 1) {
        throw new BadRequestException(
          'This email is registered under multiple tenants. Provide tenantSlug to disambiguate.',
        );
      }
    }

    if (candidates.length === 0) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: candidates[0].id } });

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('This account is not active.');
    }

    const validPassword = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.record({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const tokens = await this.issueTokens(
      { id: user.id, tenantId: user.tenantId, email: user.email },
      ctx,
    );

    return { user: this.toPublicUser(user), ...tokens };
  }

  async refresh(refreshTokenPlain: string, ctx: RequestContext = {}) {
    const tokenHash = hashToken(refreshTokenPlain);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (existing.revokedAt) {
      // Reuse of a rotated-out (or logged-out) token: treat as compromised
      // and revoke every outstanding refresh token for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token has already been used. All sessions revoked.');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const tokens = await this.issueTokens(
      { id: user.id, tenantId: user.tenantId, email: user.email },
      ctx,
    );

    const newTokenHash = hashToken(tokens.refreshToken);
    const newToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newTokenHash },
    });
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByTokenId: newToken?.id },
    });

    await this.auditService.record({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'auth.refresh',
      entityType: 'RefreshToken',
      entityId: existing.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { user: this.toPublicUser(user), ...tokens };
  }

  async logout(refreshTokenPlain: string) {
    const tokenHash = hashToken(refreshTokenPlain);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (existing && !existing.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      await this.auditService.record({
        tenantId: undefined,
        actorUserId: existing.userId,
        action: 'auth.logout',
        entityType: 'RefreshToken',
        entityId: existing.id,
      });
    }
    return { loggedOut: true };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = dto.email.toLowerCase();
    let user;
    if (dto.tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
      user = tenant
        ? await this.prisma.user.findUnique({
            where: { tenantId_email: { tenantId: tenant.id, email } },
          })
        : null;
    } else {
      const users = await this.prisma.user.findMany({ where: { email } });
      user = users.length === 1 ? users[0] : null;
    }

    // Always return a generic success shape so this endpoint can't be used
    // to enumerate which emails are registered.
    if (!user) {
      return { requested: true };
    }

    const token = generateOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    await this.auditService.record({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'auth.password_reset_requested',
      entityType: 'User',
      entityId: user.id,
    });

    // No email provider is wired up yet (future milestone). Returning the
    // token here is intentionally gated to non-production so the flow is
    // provable end-to-end without one. See ADR-0004.
    const includeToken = this.configService.get<string>('nodeEnv') !== 'production';
    return { requested: true, ...(includeToken ? { token } : {}) };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.record({
      actorUserId: resetToken.userId,
      action: 'auth.password_reset_completed',
      entityType: 'User',
      entityId: resetToken.userId,
    });

    return { reset: true };
  }

  async requestEmailVerification(userId: string) {
    const token = generateOpaqueToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });
    const includeToken = this.configService.get<string>('nodeEnv') !== 'production';
    return { requested: true, ...(includeToken ? { token } : {}) };
  }

  async verifyEmail(token: string) {
    const tokenHash = hashToken(token);
    const verificationToken = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (
      !verificationToken ||
      verificationToken.usedAt ||
      verificationToken.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired email verification token.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { verified: true };
  }

  private toPublicUser(user: {
    id: string;
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    emailVerifiedAt: Date | null;
  }) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }
}
