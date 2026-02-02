import request from "supertest";
import { describe, it, expect } from "@jest/globals";
import { createTestApp, createTestUser, createTestServer, authHeader } from "./helpers.js";

describe("User moderation (block/report)", () => {
  const app = createTestApp();

  async function getGeneralChannel(token: string, serverId: string) {
    const res = await request(app)
      .get(`/servers/${serverId}/channels`)
      .set(authHeader(token));
    return res.body.find((c: { name: string }) => c.name === "general");
  }

  it("blocks and unblocks users idempotently", async () => {
    const owner = await createTestUser(app);
    const server = await createTestServer(app, owner.accessToken);

    const member = await createTestUser(app, {
      username: "member_block",
      email: "member_block@example.com",
      password: "password123",
    });

    await request(app)
      .post(`/servers/${server.id}/join`)
      .set(authHeader(member.accessToken))
      .send({ inviteCode: server.inviteCode });

    const blockRes = await request(app)
      .post(`/servers/${server.id}/users/${owner.user.id}/block`)
      .set(authHeader(member.accessToken));
    expect(blockRes.status).toBe(204);

    const blockAgain = await request(app)
      .post(`/servers/${server.id}/users/${owner.user.id}/block`)
      .set(authHeader(member.accessToken));
    expect(blockAgain.status).toBe(204);

    const listRes = await request(app)
      .get(`/servers/${server.id}/blocks`)
      .set(authHeader(member.accessToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.blockedUserIds).toEqual([owner.user.id]);

    const unblockRes = await request(app)
      .delete(`/servers/${server.id}/users/${owner.user.id}/block`)
      .set(authHeader(member.accessToken));
    expect(unblockRes.status).toBe(204);

    const listAfter = await request(app)
      .get(`/servers/${server.id}/blocks`)
      .set(authHeader(member.accessToken));
    expect(listAfter.status).toBe(200);
    expect(listAfter.body.blockedUserIds).toEqual([]);

    const unblockAgain = await request(app)
      .delete(`/servers/${server.id}/users/${owner.user.id}/block`)
      .set(authHeader(member.accessToken));
    expect(unblockAgain.status).toBe(204);
  });

  it("sends admin DM on report and block", async () => {
    const owner = await createTestUser(app);
    const server = await createTestServer(app, owner.accessToken);

    const reporter = await createTestUser(app, {
      username: "reporter",
      email: "reporter@example.com",
      password: "password123",
    });

    await request(app)
      .post(`/servers/${server.id}/join`)
      .set(authHeader(reporter.accessToken))
      .send({ inviteCode: server.inviteCode });

    const reportRes = await request(app)
      .post(`/servers/${server.id}/users/${owner.user.id}/report`)
      .set(authHeader(reporter.accessToken))
      .send({ reason: "spam" });
    expect(reportRes.status).toBe(201);
    expect(reportRes.body.reporterId).toBe(reporter.user.id);
    expect(reportRes.body.reportedId).toBe(owner.user.id);

    const blockRes = await request(app)
      .post(`/servers/${server.id}/users/${owner.user.id}/block`)
      .set(authHeader(reporter.accessToken));
    expect(blockRes.status).toBe(204);

    const convosRes = await request(app)
      .get(`/dm/conversations?serverId=${server.id}`)
      .set(authHeader(owner.accessToken));
    expect(convosRes.status).toBe(200);

    const convo = convosRes.body.find((c: { participantIds: string[] }) =>
      c.participantIds.includes("system-admin"),
    );
    expect(convo).toBeTruthy();

    const messagesRes = await request(app)
      .get(`/dm/conversations/${convo.id}/messages?limit=10&serverId=${server.id}`)
      .set(authHeader(owner.accessToken));
    expect(messagesRes.status).toBe(200);

    const contents = messagesRes.body.data.map((m: { content: string }) => m.content).join(" ");
    expect(contents).toContain("a signalé");
    expect(contents).toContain("a bloqué");
  });

  it("masks messages from blocked users and restores after unblock", async () => {
    const owner = await createTestUser(app);
    const server = await createTestServer(app, owner.accessToken);
    const channel = await getGeneralChannel(owner.accessToken, server.id);

    const blocker = await createTestUser(app, {
      username: "blocker",
      email: "blocker@example.com",
      password: "password123",
    });
    const blocked = await createTestUser(app, {
      username: "blocked",
      email: "blocked@example.com",
      password: "password123",
    });

    await request(app)
      .post(`/servers/${server.id}/join`)
      .set(authHeader(blocker.accessToken))
      .send({ inviteCode: server.inviteCode });
    await request(app)
      .post(`/servers/${server.id}/join`)
      .set(authHeader(blocked.accessToken))
      .send({ inviteCode: server.inviteCode });

    await request(app)
      .post(`/channels/${channel.id}/messages`)
      .set(authHeader(blocked.accessToken))
      .send({ content: "Hello from blocked user" });

    await request(app)
      .post(`/servers/${server.id}/users/${blocked.user.id}/block`)
      .set(authHeader(blocker.accessToken));

    const listRes = await request(app)
      .get(`/channels/${channel.id}/messages`)
      .set(authHeader(blocker.accessToken));
    expect(listRes.status).toBe(200);
    const maskedMessage = listRes.body.data.find((m: { authorId: string }) => m.authorId === blocked.user.id);
    expect(maskedMessage.masked).toBe(true);
    expect(maskedMessage.content).toBeNull();

    await request(app)
      .delete(`/servers/${server.id}/users/${blocked.user.id}/block`)
      .set(authHeader(blocker.accessToken));

    const afterUnblock = await request(app)
      .get(`/channels/${channel.id}/messages`)
      .set(authHeader(blocker.accessToken));
    const visibleMessage = afterUnblock.body.data.find((m: { authorId: string }) => m.authorId === blocked.user.id);
    expect(visibleMessage.masked).not.toBe(true);
    expect(visibleMessage.content).toBe("Hello from blocked user");
  });

  it("masks direct messages for blocked users", async () => {
    const owner = await createTestUser(app);
    const server = await createTestServer(app, owner.accessToken);

    const blocker = await createTestUser(app, {
      username: "dm_blocker",
      email: "dm_blocker@example.com",
      password: "password123",
    });
    const blocked = await createTestUser(app, {
      username: "dm_blocked",
      email: "dm_blocked@example.com",
      password: "password123",
    });

    await request(app)
      .post(`/servers/${server.id}/join`)
      .set(authHeader(blocker.accessToken))
      .send({ inviteCode: server.inviteCode });
    await request(app)
      .post(`/servers/${server.id}/join`)
      .set(authHeader(blocked.accessToken))
      .send({ inviteCode: server.inviteCode });

    const convoRes = await request(app)
      .post(`/dm/conversations`)
      .set(authHeader(blocker.accessToken))
      .send({ targetUserId: blocked.user.id });
    expect(convoRes.status).toBe(201);

    await request(app)
      .post(`/dm/conversations/${convoRes.body.id}/messages`)
      .set(authHeader(blocked.accessToken))
      .send({ content: "DM hello" });

    await request(app)
      .post(`/servers/${server.id}/users/${blocked.user.id}/block`)
      .set(authHeader(blocker.accessToken));

    const dmMessages = await request(app)
      .get(`/dm/conversations/${convoRes.body.id}/messages?limit=10&serverId=${server.id}`)
      .set(authHeader(blocker.accessToken));
    expect(dmMessages.status).toBe(200);
    const masked = dmMessages.body.data.find((m: { authorId: string }) => m.authorId === blocked.user.id);
    expect(masked.masked).toBe(true);
    expect(masked.content).toBeNull();
  });
});
