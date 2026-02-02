import request from 'supertest';
import { createTestApp, createTestUser, createTestServer, createTestChannel, authHeader } from './helpers.js';
import { describe, it, expect } from '@jest/globals';

describe('Channel API', () => {
  const app = createTestApp();

  describe('POST /servers/:serverId/channels', () => {
    it('should create channel as owner', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .post(`/servers/${server.id}/channels`)
        .set(authHeader(accessToken))
        .send({ name: 'new-channel' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('new-channel');
      expect(res.body.serverId).toBe(server.id);
    });
    it('should return 400 when name is missing', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .post(`/servers/${server.id}/channels`)
        .set(authHeader(accessToken))
        .send({});

      expect(res.status).toBe(422);
    });
  });

  describe('GET /servers/:serverId/channels', () => {
    it('should return server channels', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .get(`/servers/${server.id}/channels`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /channels/:id', () => {
    it('should return channel details', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);
      const channel = await createTestChannel(app, accessToken, server.id);

      const res = await request(app)
        .get(`/channels/${channel.id}`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(channel.id);
    });
  });

  describe('PUT /channels/:id', () => {
    it('should update channel as owner', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);
      const channel = await createTestChannel(app, accessToken, server.id);

      const res = await request(app)
        .put(`/channels/${channel.id}`)
        .set(authHeader(accessToken))
        .send({ name: 'updated-channel' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('updated-channel');
    });
  });

  describe('DELETE /channels/:id', () => {
    it('should delete channel as owner', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);
      const channel = await createTestChannel(app, accessToken, server.id);

      const res = await request(app)
        .delete(`/channels/${channel.id}`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(204);
    });

    it('should prevent deleting last channel', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const channelsRes = await request(app)
        .get(`/servers/${server.id}/channels`)
        .set(authHeader(accessToken));

      const generalChannel = channelsRes.body.find((c: { name: string }) => c.name === 'general');

      const res = await request(app)
        .delete(`/channels/${generalChannel.id}`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(403);
    });
  });
});
