import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware.js';
import { validate, validateBody, validateParams, validateQuery } from '../middlewares/validation.middleware.js';
import { authService } from '../services/auth.service.js';
import type { Request, Response, NextFunction } from 'express';

function createNextSpy() {
  const next = jest.fn() as NextFunction;
  return next;
}

describe('Validation middleware', () => {
  it('Given valid payload When validate Then calls next without error', () => {
    const schema = z.object({
      body: z.object({ value: z.string() }),
      query: z.object({}),
      params: z.object({}),
    });
    const req = { body: { value: 'ok' }, query: {}, params: {} } as unknown as Request;
    const next = createNextSpy();

    validate(schema)(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('Given invalid payload When validate Then passes error to next', () => {
    const schema = z.object({
      body: z.object({ value: z.string() }),
      query: z.object({}),
      params: z.object({}),
    });
    const req = { body: {}, query: {}, params: {} } as unknown as Request;
    const next = createNextSpy();

    validate(schema)(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('Given valid body When validateBody Then mutates req.body', () => {
    const schema = z.object({ value: z.string().transform((value) => value.trim()) });
    const req = { body: { value: ' test ' } } as unknown as Request;
    const next = createNextSpy();

    validateBody(schema)(req, {} as Response, next);
    expect(req.body.value).toBe('test');
    expect(next).toHaveBeenCalledWith();
  });

  it('Given invalid body When validateBody Then passes error to next', () => {
    const schema = z.object({ value: z.string().min(2) });
    const req = { body: { value: 'a' } } as unknown as Request;
    const next = createNextSpy();

    validateBody(schema)(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('Given valid query When validateQuery Then mutates req.query', () => {
    const schema = z.object({ limit: z.coerce.number().int().min(1).max(10) });
    const req = { query: { limit: '5' } } as unknown as Request;
    const next = createNextSpy();

    validateQuery(schema)(req, {} as Response, next);
    expect(req.query.limit).toBe(5);
    expect(next).toHaveBeenCalledWith();
  });

  it('Given invalid params When validateParams Then passes error to next', () => {
    const schema = z.object({ id: z.string().uuid() });
    const req = { params: { id: 'not-uuid' } } as unknown as Request;
    const next = createNextSpy();

    validateParams(schema)(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('Auth middleware', () => {
  it('Given missing header When authMiddleware Then returns Unauthorized', () => {
    const req = { headers: {} } as unknown as Request;
    const next = createNextSpy();

    authMiddleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('Given invalid token When authMiddleware Then returns Unauthorized', () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } } as unknown as Request;
    const next = createNextSpy();

    authMiddleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('Given valid token When authMiddleware Then sets userId', async () => {
    const { accessToken } = await authService.generateTokens('user-123');
    const req = { headers: { authorization: `Bearer ${accessToken}` } } as unknown as Request;
    const next = createNextSpy();

    authMiddleware(req, {} as Response, next);
    expect((req as { userId?: string }).userId).toBe('user-123');
    expect(next).toHaveBeenCalledWith();
  });

  it('Given invalid token When optionalAuthMiddleware Then does not error', () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } } as unknown as Request;
    const next = createNextSpy();

    optionalAuthMiddleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
