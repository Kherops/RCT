import request from 'supertest';
import { createTestApp, createTestUser, authHeader } from './helpers.js';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Auth API', () => {
  const app = createTestApp();

  describe('POST /auth/signup', () => {
    it('should create a new user', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.username).toBe('newuser');
      expect(res.body.user.email).toBe('new@example.com');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should reject duplicate email', async () => {
      await createTestUser(app);

      const res = await request(app)
        .post('/auth/signup')
        .send({
          username: 'another',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Email');
    });

    it('should reject duplicate username', async () => {
      await createTestUser(app);

      const res = await request(app)
        .post('/auth/signup')
        .send({
          username: 'testuser',
          email: 'different@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Username');
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'short',
        });

      expect(res.status).toBe(422);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          username: 'newuser',
          email: 'invalid-email',
          password: 'password123',
        });

      expect(res.status).toBe(422);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await createTestUser(app);
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Invalid');
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user', async () => {
      const { accessToken } = await createTestUser(app);

      const res = await request(app)
        .get('/auth/me')
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body.username).toBe('testuser');
      expect(res.body.email).toBe('test@example.com');
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set(authHeader('invalid-token'));

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const { accessToken, refreshToken } = await createTestUser(app);

      const res = await request(app)
        .post('/auth/logout')
        .set(authHeader(accessToken))
        .send({ refreshToken });

      expect(res.status).toBe(204);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens', async () => {
      const { refreshToken } = await createTestUser(app);

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
    });
  });
});

