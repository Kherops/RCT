import { describe, it, expect } from "@jest/globals";
import { banService } from "../services/ban.service.js";
import { serverBanRepository } from "../repositories/server-ban.repository.js";
import { createUser, createServer, addMember } from "./seed.js";

describe("Ban service", () => {
  it("allows owner to ban a member with a temporary duration", async () => {
    const owner = await createUser({ username: "owner-ban" });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, "OWNER");

    const member = await createUser({ username: "member-ban" });
    await addMember(server.id, member.id, "MEMBER");

    const ban = await banService.banMember(server.id, member.id, owner.id, {
      type: "TEMPORARY",
      durationMinutes: 30,
      reason: "Cooldown",
    });

    expect(ban.serverId).toBe(server.id);
    expect(ban.userId).toBe(member.id);
    expect(ban.type).toBe("TEMPORARY");
    expect(ban.expiresAt).toBeInstanceOf(Date);
  });

  it("rejects non-owner ban attempts", async () => {
    const owner = await createUser({ username: "owner-ban-2" });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, "OWNER");

    const member = await createUser({ username: "member-ban-2" });
    await addMember(server.id, member.id, "MEMBER");

    await expect(
      banService.banMember(server.id, owner.id, member.id, {
        type: "PERMANENT",
      }),
    ).rejects.toThrow("Only the owner can ban members");
  });

  it("auto-expires temporary bans when checking status", async () => {
    const owner = await createUser({ username: "owner-ban-3" });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, "OWNER");

    const member = await createUser({ username: "member-ban-3" });
    await addMember(server.id, member.id, "MEMBER");

    await serverBanRepository.upsert({
      serverId: server.id,
      userId: member.id,
      createdById: owner.id,
      type: "TEMPORARY",
      expiresAt: new Date(Date.now() - 60_000),
    });

    const status = await banService.getBanStatus(server.id, member.id);
    expect(status.isBanned).toBe(false);
  });

  it("allows owner to unban a member", async () => {
    const owner = await createUser({ username: "owner_unban" });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, "OWNER");

    const member = await createUser({ username: "member_unban" });
    await addMember(server.id, member.id, "MEMBER");

    await banService.banMember(server.id, member.id, owner.id, {
      type: "PERMANENT",
    });

    await banService.unbanMember(server.id, member.id, owner.id);

    const active = await banService.getActiveBan(server.id, member.id);
    expect(active).toBeNull();
  });
});
