import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';

const ctxWithHeaders = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('AdminKeyGuard', () => {
  let guard: AdminKeyGuard;

  beforeEach(() => {
    guard = new AdminKeyGuard();
    delete process.env.ADMIN_API_KEY;
  });

  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
  });

  it('allows all requests when ADMIN_API_KEY is not set (fail-open POC mode)', () => {
    expect(guard.canActivate(ctxWithHeaders({}))).toBe(true);
  });

  it('allows a request with the matching x-admin-key header', () => {
    process.env.ADMIN_API_KEY = 's3cret';
    expect(guard.canActivate(ctxWithHeaders({ 'x-admin-key': 's3cret' }))).toBe(true);
  });

  it('rejects a request with a wrong key', () => {
    process.env.ADMIN_API_KEY = 's3cret';
    expect(() => guard.canActivate(ctxWithHeaders({ 'x-admin-key': 'nope' }))).toThrow(UnauthorizedException);
  });

  it('rejects a request with no key when one is required', () => {
    process.env.ADMIN_API_KEY = 's3cret';
    expect(() => guard.canActivate(ctxWithHeaders({}))).toThrow(UnauthorizedException);
  });
});
