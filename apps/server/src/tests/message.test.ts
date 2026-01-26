import request from 'supertest';
import { createTestApp, createTestUser, createTestServer, authHeader } from './helpers.js';
import { describe, it, beforeEach } from 'node:test';
import { expect } from '@jest/globals';
describe('Message API', () => {
  const app = createTestApp();

  async function getGeneralChannel(app: ReturnType<typeof createTestApp>, token: string, serverId: string) {
    const res = await request(app)
      .get(`/servers/${serverId}/channels`)
      .set(authHeader(token));
    return res.body.find((c: { name: string }) => c.name === 'general');
  }

  describe('POST /channels/:channelId/messages', () => {
    it('should send message as member', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);
      const channel = await getGeneralChannel(app, accessToken, server.id);

      const res = await request(app)
        .post(`/channels/${channel.id}/messages`)
        .set(authHeader(accessToken))
        .send({ content: 'Hello, world!' });

      expect(res.status).toBe(201);
      expect(res.body.content).toBe('Hello, world!');
      expect(res.body.channelId).toBe(channel.id);
      expect(res.body.author).toHaveProperty('id');
    });

    it('should reject non-member', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);
      const channel = await getGeneralChannel(app, owner, server.id);

      const { accessToken: other } = await createTestUser(app, {
        username: 'other',
        email: 'other@example.com',
        password: 'password123',
      });

      const res = await request(app)
        .post(`/channels/${channel.id}/messages`)
        .set(authHeader(other))
        .send({ content: 'Hacked!' });

      expect(res.status).toBe(403);
    });

    it('should reject empty message', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);
      const channel = await getGeneralChannel(app, accessToken, server.id);

      const res = await request(app)
        .post(`/channels/${channel.id}/messages`)
        .set(authHeader(accessToken))
        .send({ content: '' });

      expect(res.status).toBe(422);
    });
  });

  describe('GET /channels/:channelId/messages', () => {
    it('should return channel messages with pagination', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);
      const channel = await getGeneralChannel(app, accessToken, server.id);

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/channels/${channel.id}/messages`)
          .set(authHeader(accessToken))
          .send({ content: `Message ${i}` });
      }

      const res = await request(app)
        .get(`/channels/${channel.id}/messages?limit=3`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body).toHaveProperty('nextCursor');
      expect(res.body).toHaveProperty('hasMore');
    });
  });

  describe('DELETE /messages/:id', () => {
    it('should delete own message', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);
      const channel = await getGeneralChannel(app, accessToken, server.id);

      const msgRes = await request(app)
        .post(`/channels/${channel.id}/messages`)
        .set(authHeader(accessToken))
        .send({ content: 'To delete' });

      const res = await request(app)
        .delete(`/messages/${msgRes.body.id}`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(204);
    });

    it('should allow owner to delete others message', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);
      const channel = await getGeneralChannel(app, owner, server.id);

      const { accessToken: member } = await createTestUser(app, {
        username: 'member',
        email: 'member@example.com',
        password: 'password123',
      });

      await request(app)
        .post(`/servers/${server.id}/join`)
        .set(authHeader(member))
        .send({ inviteCode: server.inviteCode });

      const msgRes = await request(app)
        .post(`/channels/${channel.id}/messages`)
        .set(authHeader(member))
        .send({ content: 'Member message' });

      const res = await request(app)
        .delete(`/messages/${msgRes.body.id}`)
        .set(authHeader(owner));

      expect(res.status).toBe(204);
    });

    it('should prevent member from deleting others message', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);
      const channel = await getGeneralChannel(app, owner, server.id);

      const msgRes = await request(app)
        .post(`/channels/${channel.id}/messages`)
        .set(authHeader(owner))
        .send({ content: 'Owner message' });

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
        .delete(`/messages/${msgRes.body.id}`)
        .set(authHeader(member));

      expect(res.status).toBe(403);
    });
  });
});
