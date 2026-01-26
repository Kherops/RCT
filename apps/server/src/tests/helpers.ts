import request from 'supertest';
import express from 'express';
import cors from 'cors';
import routes from '../http/routes/index.js';
import { errorHandler, notFoundHandler } from '../middlewares/error.middleware.js';

export function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export async function createTestUser(app: express.Application, userData = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
}) {
  const res = await request(app)
    .post('/auth/signup')
    .send(userData);
  return res.body;
}

export async function loginTestUser(app: express.Application, credentials = {
  email: 'test@example.com',
  password: 'password123',
}) {
  const res = await request(app)
    .post('/auth/login')
    .send(credentials);
  return res.body;
}

export async function createTestServer(app: express.Application, token: string, name = 'Test Server') {
  const res = await request(app)
    .post('/servers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  return res.body;
}

export async function createTestChannel(app: express.Application, token: string, serverId: string, name = 'test-channel') {
  const res = await request(app)
    .post(`/servers/${serverId}/channels`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  return res.body;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
