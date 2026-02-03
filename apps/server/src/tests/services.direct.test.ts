import { describe, it, expect } from '@jest/globals';
import { directService } from '../services/direct.service.js';
import { directConversationRepository } from '../repositories/direct-conversation.repository.js';
import { directMessageRepository } from '../repositories/direct-message.repository.js';
import { userBlockRepository } from '../repositories/user-block.repository.js';
import { createUser, createServer, addMember } from './seed.js';

describe('Direct service', () => {
  it('Given same user When createOrGetConversation Then throws BadRequest', async () => {
    const user = await createUser({ username: 'dm-user-1' });
    await expect(directService.createOrGetConversation(user.id, user.id)).rejects.toThrow('yourself');
  });

  it('Given missing target When createOrGetConversation Then throws NotFound', async () => {
    const user = await createUser({ username: 'dm-user-2' });
    await expect(directService.createOrGetConversation(user.id, 'missing-user')).rejects.toThrow('User');
  });

  it('Given existing conversation When createOrGetConversation Then returns same id', async () => {
    const userA = await createUser({ username: 'dm-user-3' });
    const userB = await createUser({ username: 'dm-user-4' });
    const convo = await directService.createOrGetConversation(userA.id, userB.id);
    const second = await directService.createOrGetConversation(userA.id, userB.id);
    expect(second.id).toBe(convo.id);
  });

  it('Given blocked last message When getUserConversations Then masks preview', async () => {
    const owner = await createUser({ username: 'dm-owner' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');

    const blocker = await createUser({ username: 'dm-blocker' });
    const blocked = await createUser({ username: 'dm-blocked' });
    await addMember(server.id, blocker.id, 'MEMBER');
    await addMember(server.id, blocked.id, 'MEMBER');

    const convo = await directConversationRepository.create([blocker.id, blocked.id]);
    await directMessageRepository.create({
      conversationId: convo.id,
      authorId: blocked.id,
      content: 'secret',
    });

    await userBlockRepository.createIfMissing(blocker.id, blocked.id, server.id);

    const convos = await directService.getUserConversations(blocker.id, server.id);
    expect(convos[0].lastMessage?.content).toBeNull();
  });

  it('Given blocked sender When getConversationMessages Then masks content', async () => {
    const owner = await createUser({ username: 'dm-owner-2' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');

    const blocker = await createUser({ username: 'dm-blocker-2' });
    const blocked = await createUser({ username: 'dm-blocked-2' });
    await addMember(server.id, blocker.id, 'MEMBER');
    await addMember(server.id, blocked.id, 'MEMBER');

    const convo = await directConversationRepository.create([blocker.id, blocked.id]);
    await directMessageRepository.create({
      conversationId: convo.id,
      authorId: blocked.id,
      content: 'blocked text',
    });

    await userBlockRepository.createIfMissing(blocker.id, blocked.id, server.id);

    const result = await directService.getConversationMessages(convo.id, blocker.id, {
      limit: 10,
      serverId: server.id,
    });
    const masked = result.data.find((msg) => msg.authorId === blocked.id);
    expect(masked?.content).toBeNull();
    expect(masked?.masked).toBe(true);
  });

  it('Given invalid reply target When sendMessage Then throws NotFound', async () => {
    const userA = await createUser({ username: 'dm-user-5' });
    const userB = await createUser({ username: 'dm-user-6' });
    const convo = await directConversationRepository.create([userA.id, userB.id]);

    await expect(
      directService.sendMessage(convo.id, userA.id, 'hi', undefined, 'missing-reply')
    ).rejects.toThrow('Message');
  });

  it('Given empty content and no gif When sendMessage Then throws Conflict', async () => {
    const userA = await createUser({ username: 'dm-user-7' });
    const userB = await createUser({ username: 'dm-user-8' });
    const convo = await directConversationRepository.create([userA.id, userB.id]);

    await expect(
      directService.sendMessage(convo.id, userA.id, '   ')
    ).rejects.toThrow('cannot be empty');
  });

  it('Given non-author When deleteMessage Then throws Forbidden', async () => {
    const userA = await createUser({ username: 'dm-user-9' });
    const userB = await createUser({ username: 'dm-user-10' });
    const convo = await directConversationRepository.create([userA.id, userB.id]);
    const message = await directMessageRepository.create({
      conversationId: convo.id,
      authorId: userA.id,
      content: 'hello',
    });

    await expect(directService.deleteMessage(message.id, userB.id)).rejects.toThrow('own direct messages');
  });
});
