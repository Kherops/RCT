import { describe, it, expect } from '@jest/globals';
import { hasPermission, canManageRole, getRoleHierarchy, isRoleHigherOrEqual } from '../domain/policies.js';
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  BadRequestError,
} from '../domain/errors.js';

describe('Domain policies', () => {
  it('Given roles When checking permissions Then returns expected results', () => {
    expect(hasPermission('OWNER', 'server:update')).toBe(true);
    expect(hasPermission('ADMIN', 'server:update')).toBe(false);
    expect(hasPermission('MEMBER', 'channel:create')).toBe(false);
  });

  it('Given manager roles When checking canManageRole Then enforces ownership rules', () => {
    expect(canManageRole('ADMIN', 'MEMBER')).toBe(false);
    expect(canManageRole('OWNER', 'OWNER')).toBe(false);
    expect(canManageRole('OWNER', 'ADMIN')).toBe(true);
  });

  it('Given roles When comparing hierarchy Then returns correct order', () => {
    expect(getRoleHierarchy('OWNER')).toBeGreaterThan(getRoleHierarchy('ADMIN'));
    expect(getRoleHierarchy('ADMIN')).toBeGreaterThan(getRoleHierarchy('MEMBER'));
    expect(isRoleHigherOrEqual('ADMIN', 'ADMIN')).toBe(true);
    expect(isRoleHigherOrEqual('MEMBER', 'ADMIN')).toBe(false);
  });
});

describe('Domain errors', () => {
  it('Given an AppError When constructed Then exposes status and code', () => {
    const err = new AppError(418, 'Teapot', 'TEAPOT');
    expect(err.statusCode).toBe(418);
    expect(err.message).toBe('Teapot');
    expect(err.code).toBe('TEAPOT');
    expect(err.name).toBe('AppError');
  });

  it('Given concrete errors When constructed Then set defaults', () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().code).toBe('FORBIDDEN');
    expect(new NotFoundError('User').message).toBe('User not found');
    expect(new ConflictError('Conflict').statusCode).toBe(409);
    expect(new ValidationError('Invalid').statusCode).toBe(422);
    expect(new BadRequestError('Bad').statusCode).toBe(400);
  });
});
