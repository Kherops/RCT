import { describe, it, expect } from '@jest/globals';
import { updateProfileSchema } from '../http/schemas/user.schema.js';
import { createMessageSchema, getMessagesQuerySchema, updateMessageSchema } from '../http/schemas/message.schema.js';

describe('User schema', () => {
  it('Given missing fields When parsing updateProfile Then fails refinement', () => {
    expect(() => updateProfileSchema.parse({})).toThrow();
  });

  it('Given bio When parsing updateProfile Then trims value', () => {
    const parsed = updateProfileSchema.parse({ bio: '  hello  ' });
    expect(parsed.bio).toBe('hello');
  });

  it('Given empty avatarUrl When parsing updateProfile Then accepts', () => {
    const parsed = updateProfileSchema.parse({ avatarUrl: '' });
    expect(parsed.avatarUrl).toBe('');
  });
});

describe('Message schema', () => {
  it('Given empty payload When parsing createMessage Then fails', () => {
    expect(() => createMessageSchema.parse({})).toThrow();
  });

  it('Given gifUrl When parsing createMessage Then passes', () => {
    const parsed = createMessageSchema.parse({ gifUrl: 'https://example.com/g.gif' });
    expect(parsed.gifUrl).toBe('https://example.com/g.gif');
  });

  it('Given content When parsing createMessage Then trims requirement passes', () => {
    const parsed = createMessageSchema.parse({ content: 'hello' });
    expect(parsed.content).toBe('hello');
  });

  it('Given valid content When parsing updateMessage Then passes', () => {
    const parsed = updateMessageSchema.parse({ content: 'hi' });
    expect(parsed.content).toBe('hi');
  });

  it('Given empty query When parsing getMessagesQuery Then applies default', () => {
    const parsed = getMessagesQuerySchema.parse({});
    expect(parsed.limit).toBe(50);
  });
});
