import request from 'supertest';
import { createTestApp, createTestUser, createTestServer, authHeader } from './helpers.js';
import { describe, it, expect } from '@jest/globals';
import { getCollections } from '../lib/mongo.js';
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

  describe('DELETE /servers/:id', () => {
    it('should allow owner to delete server and its channels', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .delete(`/servers/${server.id}`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(204);

      const collections = await getCollections();
      const serverDoc = await collections.servers.findOne({ id: server.id });
      expect(serverDoc).toBeNull();

      const channels = await collections.channels.find({ serverId: server.id }).toArray();
      expect(channels).toHaveLength(0);
    });

    it('should prevent non-owner from deleting the server', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);

      const { accessToken: other } = await createTestUser(app, {
        username: 'notowner',
        email: 'notowner@example.com',
        password: 'password123',
      });

      const res = await request(app)
        .delete(`/servers/${server.id}`)
        .set(authHeader(other));

      expect(res.status).toBe(403);

      const collections = await getCollections();
      const serverDoc = await collections.servers.findOne({ id: server.id });
      expect(serverDoc).not.toBeNull();
    });

    it('should return 404 when server does not exist', async () => {
      const { accessToken } = await createTestUser(app);

      const res = await request(app)
        .delete('/servers/non-existent')
        .set(authHeader(accessToken));

      expect(res.status).toBe(404);
    });

    it('should rollback when channel deletion fails', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const collections = await getCollections();
      const originalDeleteMany = collections.channels.deleteMany.bind(collections.channels);
      try {
        type DeleteMany = typeof originalDeleteMany;
        (collections.channels as { deleteMany: DeleteMany }).deleteMany = (async (..._args) => {
          void _args;
          throw new Error('forced channel deletion error');
        }) as DeleteMany;

        const res = await request(app)
          .delete(`/servers/${server.id}`)
          .set(authHeader(accessToken));

        expect(res.status).toBe(500);

        const serverDoc = await collections.servers.findOne({ id: server.id });
        expect(serverDoc).not.toBeNull();

        const channels = await collections.channels.find({ serverId: server.id }).toArray();
        expect(channels.length).toBeGreaterThan(0);
      } finally {
        (collections.channels as { deleteMany: typeof originalDeleteMany }).deleteMany = originalDeleteMany;
      }
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

      const serversRes = await request(app)
        .get('/servers')
        .set(authHeader(member));

      expect(serversRes.status).toBe(200);
      expect(serversRes.body.find((s: { id: string }) => s.id === server.id)).toBeUndefined();
    });

    it('should prevent owner from leaving', async () => {
      const { accessToken } = await createTestUser(app);
      const server = await createTestServer(app, accessToken);

      const res = await request(app)
        .delete(`/servers/${server.id}/leave`)
        .set(authHeader(accessToken));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_CANNOT_LEAVE');
    });

    it('should reject non-member leaving', async () => {
      const { accessToken: owner } = await createTestUser(app);
      const server = await createTestServer(app, owner);

      const { accessToken: outsider } = await createTestUser(app, {
        username: 'outsider',
        email: 'outsider@example.com',
        password: 'password123',
      });

      const res = await request(app)
        .delete(`/servers/${server.id}/leave`)
        .set(authHeader(outsider));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_MEMBER');
    });

    it('should return 404 when server does not exist', async () => {
      const { accessToken } = await createTestUser(app);

      const res = await request(app)
        .delete('/servers/nonexistent/leave')
        .set(authHeader(accessToken));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SERVER_NOT_FOUND');
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

  describe('POST /servers/:id/users/:userId/ban', () => {
    it('should allow owner to ban a member and block access', async () => {
      const { accessToken: ownerToken } = await createTestUser(app, {
        username: 'owner_ban',
        email: 'owner-ban@example.com',
        password: 'password123',
      });
      const server = await createTestServer(app, ownerToken);

      const { accessToken: memberToken, user: memberUser } = await createTestUser(app, {
        username: 'member_ban',
        email: 'member-ban@example.com',
        password: 'password123',
      });

      await request(app)
        .post(`/servers/${server.id}/join`)
        .set(authHeader(memberToken))
        .send({ inviteCode: server.inviteCode });

      const banRes = await request(app)
        .post(`/servers/${server.id}/users/${memberUser.id}/ban`)
        .set(authHeader(ownerToken))
        .send({ type: 'TEMPORARY', durationMinutes: 60 });

      expect(banRes.status).toBe(201);
      expect(banRes.body.userId).toBe(memberUser.id);
      expect(banRes.body.type).toBe('TEMPORARY');

      const statusRes = await request(app)
        .get(`/servers/${server.id}/ban-status`)
        .set(authHeader(memberToken));

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.isBanned).toBe(true);
      expect(statusRes.body.ban).toBeTruthy();
      expect(statusRes.body.banned).toBe(true);

      const serverRes = await request(app)
        .get(`/servers/${server.id}`)
        .set(authHeader(memberToken));

      expect(serverRes.status).toBe(403);
      expect(serverRes.body.error.code).toBe('BANNED');
    });

    it('should prevent non-owner from banning members', async () => {
      const { accessToken: ownerToken } = await createTestUser(app, {
        username: 'owner_ban_2',
        email: 'owner-ban-2@example.com',
        password: 'password123',
      });
      const server = await createTestServer(app, ownerToken);

      const { accessToken: actorToken } = await createTestUser(app, {
        username: 'actor_ban',
        email: 'actor-ban@example.com',
        password: 'password123',
      });
      const { accessToken: targetToken, user: targetUser } = await createTestUser(app, {
        username: 'target_ban',
        email: 'target-ban@example.com',
        password: 'password123',
      });

      await request(app)
        .post(`/servers/${server.id}/join`)
        .set(authHeader(actorToken))
        .send({ inviteCode: server.inviteCode });

      await request(app)
        .post(`/servers/${server.id}/join`)
        .set(authHeader(targetToken))
        .send({ inviteCode: server.inviteCode });

      const res = await request(app)
        .post(`/servers/${server.id}/users/${targetUser.id}/ban`)
        .set(authHeader(actorToken))
        .send({ type: 'PERMANENT' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /servers/:id/users/:userId/unban', () => {
    it('should allow owner to unban a member', async () => {
      const { accessToken: ownerToken } = await createTestUser(app, {
        username: 'owner_unban',
        email: 'owner-unban@example.com',
        password: 'password123',
      });
      const server = await createTestServer(app, ownerToken);

      const { accessToken: memberToken, user: memberUser } = await createTestUser(app, {
        username: 'member_unban',
        email: 'member-unban@example.com',
        password: 'password123',
      });

      await request(app)
        .post(`/servers/${server.id}/join`)
        .set(authHeader(memberToken))
        .send({ inviteCode: server.inviteCode });

      await request(app)
        .post(`/servers/${server.id}/users/${memberUser.id}/ban`)
        .set(authHeader(ownerToken))
        .send({ type: 'TEMPORARY', durationMinutes: 60 });

      const unbanRes = await request(app)
        .post(`/servers/${server.id}/users/${memberUser.id}/unban`)
        .set(authHeader(ownerToken));

      expect(unbanRes.status).toBe(204);

      const statusRes = await request(app)
        .get(`/servers/${server.id}/ban-status`)
        .set(authHeader(memberToken));

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.isBanned).toBe(false);
    });
  });

  describe('PUT /servers/:id/members/:memberId', () => {
    it('should allow owner to update member role', async () => {
      const { accessToken: owner } = await createTestUser(app);
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

  describe('DELETE /servers/:id/members/:memberId', () => {
    it('should allow owner to kick member', async () => {
      const { accessToken: owner } = await createTestUser(app);
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
        .delete(`/servers/${server.id}/members/${memberUser.id}`)
        .set(authHeader(owner));

      expect(res.status).toBe(204);
      
      const resMembers = await request(app)
        .get(`/servers/${server.id}/members`)
        .set(authHeader(owner));
      expect(resMembers.body).toHaveLength(1); // Only owner remaining
    });

    it('should prevent member from kicking anyone', async () => {
        const { accessToken: owner } = await createTestUser(app);
        const server = await createTestServer(app, owner);
  
        const { accessToken: member1 } = await createTestUser(app, { username: 'member1', email: 'm1@e.com', password: 'password123' });
        const { accessToken: member2, user: member2User } = await createTestUser(app, { username: 'member2', email: 'm2@e.com', password: 'password123' });
  
        await request(app).post(`/servers/${server.id}/join`).set(authHeader(member1)).send({ inviteCode: server.inviteCode });
        await request(app).post(`/servers/${server.id}/join`).set(authHeader(member2)).send({ inviteCode: server.inviteCode });
  
        const res = await request(app)
          .delete(`/servers/${server.id}/members/${member2User.id}`)
          .set(authHeader(member1));
  
        expect(res.status).toBe(403);
    });

    it('should allow admin to kick member', async () => {
        const { accessToken: owner } = await createTestUser(app);
        const server = await createTestServer(app, owner);
        
        const { accessToken: admin, user: adminUser } = await createTestUser(app, { username: 'admin', email: 'a@e.com', password: 'password123' });
        const { accessToken: member, user: memberUser } = await createTestUser(app, { username: 'member', email: 'm@e.com', password: 'password123' });

        // Setup memberships
        await request(app).post(`/servers/${server.id}/join`).set(authHeader(admin)).send({ inviteCode: server.inviteCode });
        await request(app).post(`/servers/${server.id}/join`).set(authHeader(member)).send({ inviteCode: server.inviteCode });

        // Promote admin
        await request(app)
            .put(`/servers/${server.id}/members/${adminUser.id}`)
            .set(authHeader(owner))
            .send({ role: 'ADMIN' });

        const res = await request(app)
            .delete(`/servers/${server.id}/members/${memberUser.id}`)
            .set(authHeader(admin));

        expect(res.status).toBe(204);
    });

    it('should prevent admin from kicking owner', async () => {
        const { accessToken: owner, user: ownerUser } = await createTestUser(app);
        const server = await createTestServer(app, owner);
        
        const { accessToken: admin, user: adminUser } = await createTestUser(app, { username: 'admin', email: 'a@e.com', password: 'password123' });
        
        await request(app).post(`/servers/${server.id}/join`).set(authHeader(admin)).send({ inviteCode: server.inviteCode });
        
        await request(app)
            .put(`/servers/${server.id}/members/${adminUser.id}`)
            .set(authHeader(owner))
            .send({ role: 'ADMIN' });

        const res = await request(app)
            .delete(`/servers/${server.id}/members/${ownerUser.id}`)
            .set(authHeader(admin));

        expect(res.status).toBe(403);
    });

    it('should prevent admin from kicking another admin', async () => {
        const { accessToken: owner } = await createTestUser(app);
        const server = await createTestServer(app, owner);
        
        const { accessToken: admin1, user: admin1User } = await createTestUser(app, { username: 'admin1', email: 'a1@e.com', password: 'password123' });
        const { accessToken: admin2, user: admin2User } = await createTestUser(app, { username: 'admin2', email: 'a2@e.com', password: 'password123' });
        
        await request(app).post(`/servers/${server.id}/join`).set(authHeader(admin1)).send({ inviteCode: server.inviteCode });
        await request(app).post(`/servers/${server.id}/join`).set(authHeader(admin2)).send({ inviteCode: server.inviteCode });
        
        await request(app).put(`/servers/${server.id}/members/${admin1User.id}`).set(authHeader(owner)).send({ role: 'ADMIN' });
        await request(app).put(`/servers/${server.id}/members/${admin2User.id}`).set(authHeader(owner)).send({ role: 'ADMIN' });

        const res = await request(app)
            .delete(`/servers/${server.id}/members/${admin2User.id}`)
            .set(authHeader(admin1));

        expect(res.status).toBe(403);
    });
  });
});
