import { nanoid } from "nanoid";
import { getCollections } from "../lib/mongo.js";
import { stripMongoId } from "../lib/mongo-utils.js";
import type { UserReport } from "../domain/types.js";

export const userReportRepository = {
  async create(data: {
    reporterId: string;
    reportedId: string;
    serverId: string;
    reason?: string | null;
    messageId?: string | null;
    channelId?: string | null;
  }): Promise<UserReport> {
    const { userReports } = await getCollections();
    const now = new Date();
    const report: UserReport = {
      id: nanoid(),
      reporterId: data.reporterId,
      reportedId: data.reportedId,
      serverId: data.serverId,
      reason: data.reason ?? null,
      messageId: data.messageId ?? null,
      channelId: data.channelId ?? null,
      createdAt: now,
    };

    await userReports.insertOne(report);
    return stripMongoId(report);
  },
};
