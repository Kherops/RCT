import { createServer } from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { initializeSocket } from '../socket/index.js';
import { createTestApp } from './helpers.js';
import { describe, it } from 'node:test';
import { expect, beforeAll, afterAll } from '@jest/globals';

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for event ${event}`));
    }, timeoutMs);

    socket.once(event, (data: T) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

function connectClient(baseUrl: string, token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      path: '/ws',
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}

describe('Socket.IO', () => {
  const app = createTestApp();
  const httpServer = createServer(app);

  let baseUrl: string;

  beforeAll(async () => {
    initializeSocket(httpServer, 'http://localhost');

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });

    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  it('rejects connection without token', async () => {
    await expect(
      new Promise<void>((resolve, reject) => {
        const socket = ioClient(baseUrl, {
          path: '/ws',
          transports: ['websocket'],
          forceNew: true,
          reconnection: false,
        });
        socket.once('connect', () => {
          socket.disconnect();
          resolve();
        });
        socket.once('connect_error', (err) => reject(err));
      })
    ).rejects.toBeTruthy();
  });

  it('rejects join:server when user is not a member', async () => {
    // create user
    await request(baseUrl).post('/auth/signup').send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'password123',
    });
    const login = await request(baseUrl).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });

    const socket = await connectClient(baseUrl, login.body.accessToken);

    const res = await new Promise<{ success: boolean; error?: { code?: string } }>((resolve) => {
      socket.emit('join:server', 'non-existent-or-not-member', (response: { success: boolean; error?: { code?: string } }) => resolve(response));
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('FORBIDDEN');

    socket.disconnect();
  });

  it('presence is multi-tabs safe: online once, offline once per server', async () => {
    // user A (owner)
    await request(baseUrl).post('/auth/signup').send({
      username: 'owner',
      email: 'owner@example.com',
      password: 'password123',
    });
    const ownerLogin = await request(baseUrl).post('/auth/login').send({
      email: 'owner@example.com',
      password: 'password123',
    });

    const server = await request(baseUrl)
      .post('/servers')
      .set('Authorization', `Bearer ${ownerLogin.body.accessToken}`)
      .send({ name: 'Test Server' });

    // user B (member)
    await request(baseUrl).post('/auth/signup').send({
      username: 'member',
      email: 'member@example.com',
      password: 'password123',
    });
    const memberLogin = await request(baseUrl).post('/auth/login').send({
      email: 'member@example.com',
      password: 'password123',
    });

    // join server via invite
    await request(baseUrl)
      .post(`/servers/${server.body.id}/join`)
      .set('Authorization', `Bearer ${memberLogin.body.accessToken}`)
      .send({ inviteCode: server.body.inviteCode });

    // connect sockets
    const ownerSocket = await connectClient(baseUrl, ownerLogin.body.accessToken);
    await new Promise<void>((resolve) => {
      ownerSocket.emit('join:server', server.body.id, () => resolve());
    });

    const memberSocket1 = await connectClient(baseUrl, memberLogin.body.accessToken);

    // first join should trigger user:online (to owner)
    const onlinePromise = waitForEvent<{ userId: string; serverId: string }>(ownerSocket, 'user:online');
    await new Promise<void>((resolve) => {
      memberSocket1.emit('join:server', server.body.id, () => resolve());
    });
    const online = await onlinePromise;
    expect(online.serverId).toBe(server.body.id);

    // second tab joins: should NOT trigger another user:online
    const memberSocket2 = await connectClient(baseUrl, memberLogin.body.accessToken);
    const noSecondOnline = Promise.race([
      waitForEvent(ownerSocket, 'user:online', 700).then(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 700)),
    ]);

    await new Promise<void>((resolve) => {
      memberSocket2.emit('join:server', server.body.id, () => resolve());
    });

    expect(await noSecondOnline).toBe(true);

    // disconnect one tab: should NOT emit offline
    const noOfflineYet = Promise.race([
      waitForEvent(ownerSocket, 'user:offline', 700).then(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 700)),
    ]);
    memberSocket1.disconnect();
    expect(await noOfflineYet).toBe(true);

    // disconnect second tab: should emit offline
    const offlinePromise = waitForEvent<{ userId: string; serverId: string }>(ownerSocket, 'user:offline');
    memberSocket2.disconnect();
    const offline = await offlinePromise;
    expect(offline.serverId).toBe(server.body.id);

    ownerSocket.disconnect();
  });

  it('message:send broadcasts message:new and REST delete broadcasts message:deleted', async () => {
    // user A (owner)
    await request(baseUrl).post('/auth/signup').send({
      username: 'alice2',
      email: 'alice2@example.com',
      password: 'password123',
    });
    const aLogin = await request(baseUrl).post('/auth/login').send({
      email: 'alice2@example.com',
      password: 'password123',
    });

    const server = await request(baseUrl)
      .post('/servers')
      .set('Authorization', `Bearer ${aLogin.body.accessToken}`)
      .send({ name: 'Chat Server' });

    const channel = await request(baseUrl)
      .post(`/servers/${server.body.id}/channels`)
      .set('Authorization', `Bearer ${aLogin.body.accessToken}`)
      .send({ name: 'general' });

    // user B (member)
    await request(baseUrl).post('/auth/signup').send({
      username: 'bob2',
      email: 'bob2@example.com',
      password: 'password123',
    });
    const bLogin = await request(baseUrl).post('/auth/login').send({
      email: 'bob2@example.com',
      password: 'password123',
    });

    await request(baseUrl)
      .post(`/servers/${server.body.id}/join`)
      .set('Authorization', `Bearer ${bLogin.body.accessToken}`)
      .send({ inviteCode: server.body.inviteCode });

    const socketA = await connectClient(baseUrl, aLogin.body.accessToken);
    const socketB = await connectClient(baseUrl, bLogin.body.accessToken);

    await new Promise<void>((resolve) => socketA.emit('join:server', server.body.id, () => resolve()));
    await new Promise<void>((resolve) => socketB.emit('join:server', server.body.id, () => resolve()));

    await new Promise<void>((resolve) => socketA.emit('join:channel', channel.body.id, () => resolve()));
    await new Promise<void>((resolve) => socketB.emit('join:channel', channel.body.id, () => resolve()));

    const messageNewPromise = waitForEvent<{ id: string; channelId: string; content: string }>(socketA, 'message:new');

    const sendResponse = await new Promise<{ success: boolean; data?: { id: string } }>((resolve) => {
      socketB.emit('message:send', { channelId: channel.body.id, content: 'hello from socket' }, (res: { success: boolean; data?: { id: string } }) => resolve(res));
    });

    expect(sendResponse.success).toBe(true);
    expect(sendResponse.data?.id).toBeTruthy();

    const payload = await messageNewPromise;
    expect(payload.channelId).toBe(channel.body.id);
    expect(payload.content).toBe('hello from socket');

    const messageId = sendResponse.data!.id;

    const deletedPromise = waitForEvent<{ messageId: string; channelId: string }>(socketA, 'message:deleted');

    await request(baseUrl)
      .delete(`/messages/${messageId}`)
      .set('Authorization', `Bearer ${bLogin.body.accessToken}`)
      .send();

    const deleted = await deletedPromise;
    expect(deleted.messageId).toBe(messageId);
    expect(deleted.channelId).toBe(channel.body.id);

    socketA.disconnect();
    socketB.disconnect();
  });
});
