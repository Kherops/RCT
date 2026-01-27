import request from 'supertest';
import { createTestApp, createTestUser, authHeader } from './helpers.js';

describe('Direct Messages API', () => {
  const app = createTestApp();

  async function createConversation(token: string, targetUserId: string) {
    const res = await request(app)
      .post('/dm/conversations')
      .set(authHeader(token))
      .send({ targetUserId });
    return res;
  }

  describe('POST /dm/conversations', () => {
    it('creates or returns a conversation between two users', async () => {
      const userA = await createTestUser(app, {
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });
      const userB = await createTestUser(app, {
        username: 'bob',
        email: 'bob@example.com',
        password: 'password123',
      });

      const first = await createConversation(userA.accessToken, userB.user.id);
      const second = await createConversation(userA.accessToken, userB.user.id);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.id).toBe(second.body.id);
    });
  });

  describe('GET /dm/conversations', () => {
    it('lists user conversations', async () => {
      const userA = await createTestUser(app, {
        username: 'alice2',
        email: 'alice2@example.com',
        password: 'password123',
      });
      const userB = await createTestUser(app, {
        username: 'bob2',
        email: 'bob2@example.com',
        password: 'password123',
      });

      await createConversation(userA.accessToken, userB.user.id);

      const res = await request(app)
        .get('/dm/conversations')
        .set(authHeader(userA.accessToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].participantIds).toContain(userA.user.id);
      expect(res.body[0].participantIds).toContain(userB.user.id);
    });
  });

  describe('Messages', () => {
    it('sends, reads, and deletes DMs with access control', async () => {
      const userA = await createTestUser(app, {
        username: 'alice3',
        email: 'alice3@example.com',
        password: 'password123',
      });
      const userB = await createTestUser(app, {
        username: 'bob3',
        email: 'bob3@example.com',
        password: 'password123',
      });
      const userC = await createTestUser(app, {
        username: 'charlie3',
        email: 'charlie3@example.com',
        password: 'password123',
      });

      const convoRes = await createConversation(userA.accessToken, userB.user.id);
      const conversationId = convoRes.body.id as string;

      const sendRes = await request(app)
        .post(`/dm/conversations/${conversationId}/messages`)
        .set(authHeader(userA.accessToken))
        .send({ content: 'Hello Bob' });

      expect(sendRes.status).toBe(201);
      expect(sendRes.body.content).toBe('Hello Bob');

      const readRes = await request(app)
        .get(`/dm/conversations/${conversationId}/messages?limit=10`)
        .set(authHeader(userB.accessToken));

      expect(readRes.status).toBe(200);
      expect(readRes.body.data).toHaveLength(1);
      expect(readRes.body.data[0].content).toBe('Hello Bob');

      const forbiddenRead = await request(app)
        .get(`/dm/conversations/${conversationId}/messages`)
        .set(authHeader(userC.accessToken));

      expect(forbiddenRead.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/dm/messages/${sendRes.body.id}`)
        .set(authHeader(userA.accessToken));

      expect(deleteRes.status).toBe(204);

      const deleteByOther = await request(app)
        .delete(`/dm/messages/${sendRes.body.id}`)
        .set(authHeader(userB.accessToken));

      expect(deleteByOther.status).toBe(403);
    });
  });
});
