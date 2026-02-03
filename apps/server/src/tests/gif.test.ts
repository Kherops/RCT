import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestApp, createTestUser, authHeader } from './helpers.js';
import { config } from '../config/index.js';

describe('GIF routes', () => {
  const app = createTestApp();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    config.KLIPY_API_KEY = 'test-key';
    config.KLIPY_CLIENT_KEY = 'rtc';
    config.KLIPY_BASE_URL = 'https://api.klipy.test';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('Given missing API key When searching gifs Then returns 500', async () => {
    config.KLIPY_API_KEY = undefined;
    const { accessToken } = await createTestUser(app, {
      username: 'gif_user',
      email: 'gif_user@example.com',
      password: 'password123',
    });

    const res = await request(app)
      .get('/gifs/search?q=hello')
      .set(authHeader(accessToken));

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('Given API response When fetching featured Then maps and filters results', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            id: '1',
            title: 'gif',
            media_formats: { gif: { url: 'https://cdn/g1.gif' }, tinygif: { url: 'https://cdn/t1.gif' } },
          },
          {
            id: '2',
            title: 'no-url',
            media_formats: {},
          },
        ],
      }),
    } as Response)) as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    const { accessToken } = await createTestUser(app, {
      username: 'gif_user_2',
      email: 'gif_user_2@example.com',
      password: 'password123',
    });

    const res = await request(app)
      .get('/gifs/featured?limit=2')
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].url).toBe('https://cdn/g1.gif');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('Given failed upstream When searching gifs Then returns 500', async () => {
    const fetchMock = jest.fn(async () => ({ ok: false } as Response)) as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;

    const { accessToken } = await createTestUser(app, {
      username: 'gif_user_3',
      email: 'gif_user_3@example.com',
      password: 'password123',
    });

    const res = await request(app)
      .get('/gifs/search?q=hello')
      .set(authHeader(accessToken));

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
