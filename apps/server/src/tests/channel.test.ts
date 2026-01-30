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
      expect(res.body.visibility).toBe('PUBLIC');
    });
    it('should create private channel as owner', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .post(`/servers/${server.id}/channels`)
        .set(authHeader(accessToken))
        .send({ name: 'owner-private', visibility: 'PRIVATE' });

      expect(res.status).toBe(201);
      expect(res.body.visibility).toBe('PRIVATE');
      expect(res.body.creatorId).toBeDefined();
    });

    it('should allow member creating private channel', async () => {
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
        .post(`/servers/${server.id}/channels`)
        .set(authHeader(member))
        .send({ name: 'private-room', visibility: 'PRIVATE' });

      expect(res.status).toBe(201);
      expect(res.body.visibility).toBe('PRIVATE');
      expect(res.body.creatorId).toBeDefined();
    });

    it('should forbid member creating public channel', async () => {
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
        .post(`/servers/${server.id}/channels`)
        .set(authHeader(member))
        .send({ name: 'public-attempt', visibility: 'PUBLIC' });

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toBe('ONLY_OWNER_CAN_CREATE_PUBLIC');
    });

    it('should forbid non-member creating private channel', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);

      const { accessToken: outsider } = await createTestUser(app, {
        username: 'outsider',
        email: 'outsider@example.com',
        password: 'password123',
      });

      const res = await request(app)
        .post(`/servers/${server.id}/channels`)
        .set(authHeader(outsider))
        .send({ name: 'nope', visibility: 'PRIVATE' });

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toBe('NOT_MEMBER');
    });

    it('should auto add creator as channel member for private channel', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);
      const { accessToken: member, user: memberUser } = await createTestUser(app, {
        username: 'member2',
        email: 'member2@example.com',
        password: 'password123',
      });

      await request(app)
        .post(`/servers/${server.id}/join`)
        .set(authHeader(member))
        .send({ inviteCode: server.inviteCode });

      const res = await request(app)
        .post(`/servers/${server.id}/channels`)
        .set(authHeader(member))
        .send({ name: 'private-room-2', visibility: 'PRIVATE' });

      expect(res.status).toBe(201);

      const { channelMembers } = await (await import('../lib/mongo.js')).getCollections();
      const membership = await channelMembers.findOne({ channelId: res.body.id, userId: memberUser.id });
      expect(membership).not.toBeNull();
    });

    it('should return 400 on invalid visibility', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .post(`/servers/${server.id}/channels`)
        .set(authHeader(accessToken))
        .send({ name: 'bad', visibility: 'WRONG' });

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toBe('INVALID_VISIBILITY');
    });

    it('should return 400 when name is missing', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .post(`/servers/${server.id}/channels`)
        .set(authHeader(accessToken))
        .send({ visibility: 'PRIVATE' });

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toBe('NAME_REQUIRED');
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
