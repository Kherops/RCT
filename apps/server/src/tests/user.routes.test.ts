import request from 'supertest';
import { describe, it, expect } from '@jest/globals';
import { createTestApp, createTestUser, authHeader } from './helpers.js';

describe('User routes', () => {
  const app = createTestApp();

  it('Given profile update When PATCH /users/me Then returns updated user', async () => {
    const { accessToken } = await createTestUser(app, {
      username: 'profile_user',
      email: 'profile_user@example.com',
      password: 'password123',
    });

    const res = await request(app)
      .patch('/users/me')
      .set(authHeader(accessToken))
      .send({ bio: 'Hello world', avatarUrl: '' });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('Hello world');
    expect(res.body.avatarUrl).toBe('');
  });

  it('Given empty body When PATCH /users/me Then returns 422', async () => {
    const { accessToken } = await createTestUser(app, {
      username: 'profile_user_2',
      email: 'profile_user_2@example.com',
      password: 'password123',
    });

    const res = await request(app)
      .patch('/users/me')
      .set(authHeader(accessToken))
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Given unknown user When GET /users/:id Then returns 404', async () => {
    const { accessToken } = await createTestUser(app, {
      username: 'profile_user_3',
      email: 'profile_user_3@example.com',
      password: 'password123',
    });

    const res = await request(app)
      .get('/users/unknown-id')
      .set(authHeader(accessToken));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
