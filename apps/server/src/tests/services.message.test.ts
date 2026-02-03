import { describe, it, expect } from '@jest/globals';
import { messageService } from '../services/message.service.js';
import { messageRepository } from '../repositories/message.repository.js';
import { userBlockRepository } from '../repositories/user-block.repository.js';
import { getCollections } from '../lib/mongo.js';
import { createUser, createServer, addMember, createChannel } from './seed.js';

describe('Message service', () => {
  it('Given missing channel When sendMessage Then throws NotFound', async () => {
    const user = await createUser({ username: 'msg-user-1' });
    await expect(
      messageService.sendMessage('missing', user.id, 'hello')
    ).rejects.toThrow('Channel');
  });

  it('Given non-member When sendMessage Then throws Forbidden', async () => {
    const owner = await createUser({ username: 'msg-owner' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const channel = await createChannel(server.id, 'general');

    const outsider = await createUser({ username: 'msg-outsider' });

    await expect(
      messageService.sendMessage(channel.id, outsider.id, 'hello')
    ).rejects.toThrow('not a member');
  });

  it('Given invalid reply target When sendMessage Then throws NotFound', async () => {
    const owner = await createUser({ username: 'msg-owner-2' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const channelA = await createChannel(server.id, 'general');
    const channelB = await createChannel(server.id, 'random');

    const reply = await messageRepository.create({
      channelId: channelB.id,
      authorId: owner.id,
      content: 'reply',
    });

    await expect(
      messageService.sendMessage(channelA.id, owner.id, 'hello', undefined, reply.id)
    ).rejects.toThrow('Message');
  });

  it('Given empty content and no gif When sendMessage Then throws Forbidden', async () => {
    const owner = await createUser({ username: 'msg-owner-3' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const channel = await createChannel(server.id, 'general');

    await expect(
      messageService.sendMessage(channel.id, owner.id, '   ')
    ).rejects.toThrow('cannot be empty');
  });

  it('Given script tags When sendMessage Then sanitizes content', async () => {
    const owner = await createUser({ username: 'msg-owner-4' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const channel = await createChannel(server.id, 'general');

    const { message } = await messageService.sendMessage(
      channel.id,
      owner.id,
      '<script>alert(1)</script>Hello <b>World</b>'
    );

    expect(message.content).toBe('Hello World');
  });

  it('Given blocked users When getChannelMessages Then masks content and sets hasMore', async () => {
    const owner = await createUser({ username: 'msg-owner-5' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const channel = await createChannel(server.id, 'general');

    const blocked = await createUser({ username: 'msg-blocked' });
    await addMember(server.id, blocked.id, 'MEMBER');

    await messageRepository.create({
      channelId: channel.id,
      authorId: owner.id,
      content: 'visible message',
    });
    await messageRepository.create({
      channelId: channel.id,
      authorId: owner.id,
      content: 'another visible',
    });
    const blockedMessage = await messageRepository.create({
      channelId: channel.id,
      authorId: blocked.id,
      content: 'blocked message',
    });
    const collections = await getCollections();
    await collections.messages.updateOne(
      { id: blockedMessage.id },
      { $set: { createdAt: new Date(Date.now() + 1000) } }
    );

    await userBlockRepository.createIfMissing(owner.id, blocked.id, server.id);

    const result = await messageService.getChannelMessages(channel.id, owner.id, { limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    const masked = result.data.find((msg) => msg.authorId === blocked.id);
    expect(masked?.content).toBeNull();
    expect(masked?.masked).toBe(true);
  });

  it('Given not-author and no permission When deleteMessage Then throws Forbidden', async () => {
    const owner = await createUser({ username: 'msg-owner-6' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const channel = await createChannel(server.id, 'general');

    const member = await createUser({ username: 'msg-member' });
    await addMember(server.id, member.id, 'MEMBER');

    const message = await messageRepository.create({
      channelId: channel.id,
      authorId: owner.id,
      content: 'owner message',
    });

    await expect(messageService.deleteMessage(message.id, member.id)).rejects.toThrow('permission');
  });

  it('Given deleted message When updateMessage Then throws Forbidden', async () => {
    const owner = await createUser({ username: 'msg-owner-7' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const channel = await createChannel(server.id, 'general');

    const message = await messageRepository.create({
      channelId: channel.id,
      authorId: owner.id,
      content: 'to delete',
    });
    await messageRepository.softDelete(message.id);

    await expect(messageService.updateMessage(message.id, owner.id, 'new')).rejects.toThrow('deleted');
  });

  it('Given non-author When updateMessage Then throws Forbidden', async () => {
    const owner = await createUser({ username: 'msg-owner-8' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const channel = await createChannel(server.id, 'general');

    const member = await createUser({ username: 'msg-member-2' });
    await addMember(server.id, member.id, 'MEMBER');

    const message = await messageRepository.create({
      channelId: channel.id,
      authorId: owner.id,
      content: 'owner content',
    });

    await expect(messageService.updateMessage(message.id, member.id, 'new')).rejects.toThrow('own messages');
  });
});
