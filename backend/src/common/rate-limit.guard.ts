import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Tiny in-memory fixed-window rate limiter (no external dependency). Protects the
 * write/action endpoints so a stuck or misbehaving kiosk can't hammer the backend
 * (and, in live mode, Microsoft Graph). Keyed per client IP.
 *
 * Defaults: 30 requests / 10 s. Override with RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 10_000);
  private readonly max = Number(process.env.RATE_LIMIT_MAX ?? 30);
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const now = Date.now();

    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new HttpException(
        `Túl sok kérés. Próbálja újra ${retryAfter} másodperc múlva.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    entry.count += 1;
    return true;
  }
}
