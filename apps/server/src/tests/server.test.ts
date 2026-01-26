import request from 'supertest';
import { createTestApp, createTestUser, createTestServer, authHeader } from './helpers.js';
import { describe, it, beforeEach } from 'node:test';
import { expect } from '@jest/globals';
describe('Server API', () => {
  const app = createTestApp();

  describe('POST /servers', () => {
    it('should create a new server', async () => {
      const { accessToken } = await createTestUser(app);

      const res = await request(app)
        .post('/servers')
        .set(authHeader(accessToken))
        .send({ name: 'My Server' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('My Server');
      expect(res.body).toHaveProperty('inviteCode');
    });

    it('should reject without auth', async () => {
      const res = await request(app)
        .post('/servers')
        .send({ name: 'My Server' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /servers', () => {
    it('should return user servers', async () => {
      const { accessToken } = await createTestUser(app);
      await createTestServer(app, accessToken, 'Server 1');
      await createTestServer(app, accessToken, 'Server 2');

      const res = await request(app)
        .get('/servers')
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /servers/:id', () => {
    it('should return server details for member', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .get(`/servers/${server.id}`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(server.id);
    });

    it('should reject non-member', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);

      const { accessToken: other } = await createTestUser(app, {
        username: 'other',
        email: 'other@example.com',
        password: 'password123',
      });

      const res = await request(app)
        .get(`/servers/${server.id}`)
        .set(authHeader(other));

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /servers/:id', () => {
    it('should update server as owner', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .put(`/servers/${server.id}`)
        .set(authHeader(accessToken))
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
    });

    it('should reject member update', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);

      const { accessToken: member } = await createTestUser(app, {
        username: 'member',
        email: 'member@example.com',
        password: 'password123',
      });

      await request(app)
        .post(`/servers/${server.id}/join`)
        .set(authHeader(member))
        .send({ inviteCode: server.inviteCode });

      const res = await request(app)
        .put(`/servers/${server.id}`)
        .set(authHeader(member))
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /servers/:id/join', () => {
    it('should join server with invite code', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);

      const { accessToken: joiner } = await createTestUser(app, {
        username: 'joiner',
        email: 'joiner@example.com',
        password: 'password123',
      });

      const res = await request(app)
        .post(`/servers/${server.id}/join`)
        .set(authHeader(joiner))
        .send({ inviteCode: server.inviteCode });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(server.id);
    });

    it('should reject invalid invite code', async () => {
      const { accessToken } = await createTestUser(app);

      const res = await request(app)
        .post('/servers/any/join')
        .set(authHeader(accessToken))
        .send({ inviteCode: 'invalid' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /servers/:id/leave', () => {
    it('should allow member to leave', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);

      const { accessToken: member } = await createTestUser(app, {
        username: 'member',
        email: 'member@example.com',
        password: 'password123',
      });

      await request(app)
        .post(`/servers/${server.id}/join`)
        .set(authHeader(member))
        .send({ inviteCode: server.inviteCode });

      const res = await request(app)
        .delete(`/servers/${server.id}/leave`)
        .set(authHeader(member));

      expect(res.status).toBe(204);
    });

    it('should prevent owner from leaving', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .delete(`/servers/${server.id}/leave`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /servers/:id/members', () => {
    it('should return server members', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .get(`/servers/${server.id}/members`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].role).toBe('OWNER');
    });
  });

  describe('PUT /servers/:id/members/:memberId', () => {
    it('should allow owner to update member role', async () => {
      const { accessToken: owner, user: ownerUser } = await createTestUser(app);
      const server = await createTestServer(app, owner);

      const { accessToken: member, user: memberUser } = await createTestUser(app, {
        username: 'member',
        email: 'member@example.com',
        password: 'password123',
      });

      await request(app)
        .post(`/servers/${server.id}/join`)
        .set(authHeader(member))
        .send({ inviteCode: server.inviteCode });

      const res = await request(app)
        .put(`/servers/${server.id}/members/${memberUser.id}`)
        .set(authHeader(owner))
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('ADMIN');
    });
  });
});
