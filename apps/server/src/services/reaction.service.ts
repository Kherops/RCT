import {
  messageRepository,
  directMessageRepository,
  channelRepository,
} from "../repositories/index.js";
import { NotFoundError } from "../domain/errors.js";
import { getEmitters } from "../socket/index.js";

export const reactionService = {
  async toggleChannelMessageReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ) {
    const message = await messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundError("Message");
    }

    const updated = await messageRepository.toggleReaction(
      messageId,
      userId,
      emoji,
    );

    if (updated) {
      const emitters = getEmitters();
      const channel = await channelRepository.findById(updated.channelId);
      if (channel) {
        emitters.emitMessageReaction(
          channel.serverId,
          updated.channelId,
          messageId,
          updated.reactions || {}
        );
      }
    }

    return {
      message: updated,
      channelId: message.channelId,
    };
  },

  async toggleDirectMessageReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ) {
    const message = await directMessageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundError("Message");
    }

    const updated = await directMessageRepository.toggleReaction(
      messageId,
      userId,
      emoji,
    );

    if (updated) {
      const emitters = getEmitters();
      emitters.emitDmReaction(
        updated.conversationId,
        messageId,
        updated.reactions || {}
      );
    }

    return {
      message: updated,
      conversationId: message.conversationId,
    };
  },
};
