import { describe, it, expect } from '@jest/globals';
import { channelService } from '../services/channel.service.js';
import { createUser, createServer, addMember, createChannel } from './seed.js';

describe('Channel service', () => {
  it('Given non-member When createChannel Then throws Forbidden', async () => {
    const owner = await createUser({ username: 'owner-channel' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');

    const outsider = await createUser({ username: 'outsider-channel' });

    await expect(channelService.createChannel(server.id, outsider.id, 'new')).rejects.toThrow(
      'You are not a member of this server'
    );
  });

  it('Given member without permission When createChannel Then throws Forbidden', async () => {
    const owner = await createUser({ username: 'owner-channel-2' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const member = await createUser({ username: 'member-channel' });
    await addMember(server.id, member.id, 'MEMBER');

    await expect(channelService.createChannel(server.id, member.id, 'new')).rejects.toThrow(
      'You do not have permission to create channels'
    );
  });

  it('Given owner When createChannel Then returns channel', async () => {
    const owner = await createUser({ username: 'owner-channel-3' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');

    const channel = await channelService.createChannel(server.id, owner.id, 'announcements');
    expect(channel.serverId).toBe(server.id);
    expect(channel.name).toBe('announcements');
  });

  it('Given missing channel When updateChannel Then throws NotFound', async () => {
    const owner = await createUser({ username: 'owner-channel-4' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');

    await expect(channelService.updateChannel('missing', owner.id, { name: 'x' })).rejects.toThrow('Channel');
  });

  it('Given member without permission When updateChannel Then throws Forbidden', async () => {
    const owner = await createUser({ username: 'owner-channel-5' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const member = await createUser({ username: 'member-channel-2' });
    await addMember(server.id, member.id, 'MEMBER');
    const channel = await createChannel(server.id, 'general');

    await expect(channelService.updateChannel(channel.id, member.id, { name: 'new' })).rejects.toThrow(
      'You do not have permission to update channels'
    );
  });

  it('Given last channel When deleteChannel Then throws Forbidden', async () => {
    const owner = await createUser({ username: 'owner-channel-6' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const channel = await createChannel(server.id, 'general');

    await expect(channelService.deleteChannel(channel.id, owner.id)).rejects.toThrow(
      'Cannot delete the last channel in a server'
    );
  });

  it('Given more than one channel When deleteChannel Then deletes', async () => {
    const owner = await createUser({ username: 'owner-channel-7' });
    const server = await createServer(owner.id);
    await addMember(server.id, owner.id, 'OWNER');
    const channel = await createChannel(server.id, 'general');
    await createChannel(server.id, 'random');

    await expect(channelService.deleteChannel(channel.id, owner.id)).resolves.toBeUndefined();
  });

  it('Given missing channel When getChannelServerId Then throws NotFound', async () => {
    const user = await createUser({ username: 'channel-server-id' });
    await expect(channelService.getChannelServerId(`missing-${user.id}`)).rejects.toThrow('Channel');
  });
});
