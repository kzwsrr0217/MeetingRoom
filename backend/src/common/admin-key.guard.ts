import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Protects mutating/admin endpoints with a shared secret.
 *
 * Behaviour is driven by the `ADMIN_API_KEY` environment variable:
 *  - **unset**  → guard allows every request (POC / local / mock mode) and logs
 *    a one-time warning. This keeps `docker compose up` and podman testing
 *    friction-free before an admin secret is provisioned.
 *  - **set**    → the request must send a matching `x-admin-key` header,
 *    otherwise it is rejected with 401.
 *
 * This is a stop-gap until Azure AD SSO protects the admin surface (see
 * docs/PHASE2_PLAN.md, Step 5).
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  private readonly logger = new Logger(AdminKeyGuard.name);
  private warned = false;

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY?.trim();

    if (!expected) {
      if (!this.warned) {
        this.logger.warn(
          'ADMIN_API_KEY is not set — admin/mutating endpoints are UNPROTECTED. ' +
            'Set ADMIN_API_KEY before exposing the backend beyond localhost.',
        );
        this.warned = true;
      }
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided = (req.headers['x-admin-key'] as string | undefined)?.trim();

    if (provided && provided === expected) return true;

    throw new UnauthorizedException('Invalid or missing admin key.');
  }
}
