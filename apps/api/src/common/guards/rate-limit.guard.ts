import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { RedisService } from '../../redis/redis.service';

/**
 * Fixed-window rate limiter backed by Redis (RedisService.incrementRateLimit),
 * keyed by client IP + route. Applied via @RateLimit(limit, windowSeconds)
 * on sensitive, unauthenticated endpoints (register/login/refresh) where
 * brute-forcing is the concern Redis is standing in for here.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const routePath = (request.route as { path?: string } | undefined)?.path;
    const routeKey = `${request.method}:${routePath ?? request.path}`;
    const key = `ratelimit:${routeKey}:${request.ip}`;

    const count = await this.redis.incrementRateLimit(key, options.windowSeconds);
    if (count > options.limit) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
