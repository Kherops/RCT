import { serverBanRepository } from "../repositories/server-ban.repository.js";
import { getEmitters } from "../socket/index.js";
import { buildBanPayload } from "../services/ban.service.js";

const DEFAULT_INTERVAL_MS = 30_000;

export async function expireBansOnce(now: Date = new Date()) {
  const expired = await serverBanRepository.findExpired(now);
  if (expired.length === 0) return 0;

  for (const ban of expired) {
    await serverBanRepository.deleteById(ban.id);
    const payload = buildBanPayload(ban, now);
    try {
      getEmitters().emitMemberUnbanned(ban.serverId, ban.userId, payload);
    } catch {
      // Socket not initialized (test environment)
    }
  }

  return expired.length;
}

export function startBanExpirationScheduler(
  intervalMs: number = DEFAULT_INTERVAL_MS,
) {
  const timer = setInterval(() => {
    expireBansOnce(new Date()).catch((error) => {
      console.warn("[BanScheduler] Failed to expire bans", error);
    });
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return () => clearInterval(timer);
}
