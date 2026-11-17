import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const {
  instagramConfig,
  cleanInstagramHandle,
  fetchAccountPosts,
  fetchTaggedPosts,
  fetchConnectedAccount,
  downloadPostImage,
  InstagramApiError,
} = await import('../../src/utils/instagramClient.js');

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

const ENV_KEYS = ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID', 'INSTAGRAM_GRAPH_VERSION'];
const saved = {};
let fetchMock;

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.INSTAGRAM_ACCESS_TOKEN = 'secret-token';
  process.env.INSTAGRAM_ACCOUNT_ID = '17840000000000000';
  delete process.env.INSTAGRAM_GRAPH_VERSION;
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('instagramConfig', () => {
  it('is null until both the token and a numeric account id are set', () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    expect(instagramConfig()).toBeNull();
    process.env.INSTAGRAM_ACCESS_TOKEN = 'secret-token';
    process.env.INSTAGRAM_ACCOUNT_ID = 'cardpop';
    expect(instagramConfig()).toBeNull();
  });

  it('pins a Graph version and accepts an override', () => {
    expect(instagramConfig().version).toMatch(/^v\d+\.\d+$/);
    process.env.INSTAGRAM_GRAPH_VERSION = 'v25.0';
    expect(instagramConfig().version).toBe('v25.0');
    process.env.INSTAGRAM_GRAPH_VERSION = 'latest';
    expect(instagramConfig().version).toMatch(/^v\d+\.\d+$/);
  });
});

describe('cleanInstagramHandle', () => {
  it('reads a handle from whatever was pasted', () => {
    expect(cleanInstagramHandle('@CardShowsAU')).toBe('cardshowsau');
    expect(cleanInstagramHandle(' card.shows_au ')).toBe('card.shows_au');
    expect(cleanInstagramHandle('https://www.instagram.com/CardShowsAU/?hl=en')).toBe('cardshowsau');
    expect(cleanInstagramHandle('instagram.com/cardshowsau')).toBe('cardshowsau');
  });

  it('refuses things that are not an account', () => {
    expect(cleanInstagramHandle('https://www.instagram.com/p/Cabc123/')).toBeNull();
    expect(cleanInstagramHandle('card shows')).toBeNull();
    expect(cleanInstagramHandle('name){media{id}}')).toBeNull();
    expect(cleanInstagramHandle('.dots.')).toBeNull();
    expect(cleanInstagramHandle('')).toBeNull();
    expect(cleanInstagramHandle(null)).toBeNull();
  });
});

describe('fetchAccountPosts', () => {
  it('asks Business Discovery for the account and flattens its posts', async () => {
    fetchMock.mockResolvedValue(json({
      business_discovery: {
        username: 'cardshowsau',
        media: {
          data: [
            { id: '1', caption: ' Show on 6 Dec ', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/a.jpg', permalink: 'https://www.instagram.com/p/AAA/', timestamp: '2026-11-10T01:00:00+0000' },
            {
              id: '2', media_type: 'CAROUSEL_ALBUM', permalink: 'https://www.instagram.com/p/BBB/',
              children: { data: [
                { media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/b1.jpg' },
                { media_type: 'VIDEO', media_url: 'https://scontent.cdninstagram.com/b2.mp4' },
              ] },
            },
            { id: '3', media_type: 'VIDEO', media_url: 'https://scontent.cdninstagram.com/c.mp4', permalink: 'https://www.instagram.com/reel/CCC/', caption: 'Reel' },
            { id: '4', media_type: 'IMAGE' },
          ],
        },
      },
    }));

    const posts = await fetchAccountPosts('cardshowsau', { limit: 5 });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/17840000000000000$/);
    expect(url.searchParams.get('fields')).toContain('business_discovery.username(cardshowsau)');
    expect(url.searchParams.get('fields')).toContain('media.limit(5)');
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);

    expect(posts).toHaveLength(3);
    expect(posts[0]).toMatchObject({ caption: 'Show on 6 Dec', username: 'cardshowsau', imageUrls: ['https://scontent.cdninstagram.com/a.jpg'] });
    expect(posts[1].imageUrls).toEqual(['https://scontent.cdninstagram.com/b1.jpg']);
    // A video has no photo to read — caption only.
    expect(posts[2].imageUrls).toEqual([]);
  });

  it('reports an expired token as an auth error, without the token in the message', async () => {
    fetchMock.mockResolvedValue(json({ error: { message: 'Error validating access token: secret-token', code: 190 } }, 400));

    const error = await fetchAccountPosts('cardshowsau').catch((e) => e);

    expect(error).toBeInstanceOf(InstagramApiError);
    expect(error.isAuthError).toBe(true);
    expect(error.message).not.toContain('secret-token');
  });

  it('reports an unreadable account as an ordinary error', async () => {
    fetchMock.mockResolvedValue(json({ error: { message: 'Invalid user id', code: 110 } }, 400));

    const error = await fetchAccountPosts('personalaccount').catch((e) => e);

    expect(error.isAuthError).toBe(false);
    expect(error.message).toBe('Invalid user id');
  });

  it('never leaks the request URL when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNRESET https://graph.facebook.com/?access_token=secret-token'));

    const error = await fetchAccountPosts('cardshowsau').catch((e) => e);

    expect(error.message).toBe('Could not reach Instagram.');
  });
});

describe('fetchTaggedPosts / fetchConnectedAccount', () => {
  it('reads the tags edge of the connected account', async () => {
    fetchMock.mockResolvedValue(json({ data: [
      { id: '9', caption: 'See you there', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/t.jpg', permalink: 'https://www.instagram.com/p/TTT/', username: 'SomeOrganiser' },
    ] }));

    const posts = await fetchTaggedPosts();

    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toMatch(/\/17840000000000000\/tags$/);
    expect(posts[0].username).toBe('someorganiser');
  });

  it('returns the connected handle', async () => {
    fetchMock.mockResolvedValue(json({ username: 'cardpop.com.au', id: '17840000000000000' }));
    expect(await fetchConnectedAccount()).toEqual({ username: 'cardpop.com.au' });
  });
});

describe('downloadPostImage', () => {
  it('downloads a photo from Meta\'s CDN as base64', async () => {
    fetchMock.mockResolvedValue(new Response(Buffer.from('jpeg-bytes'), { headers: { 'content-type': 'image/jpeg' } }));

    const image = await downloadPostImage('https://scontent-syd2-1.cdninstagram.com/v/a.jpg?x=1');

    expect(image).toEqual({ mediaType: 'image/jpeg', data: Buffer.from('jpeg-bytes').toString('base64') });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('never fetches a host that is not Meta\'s CDN', async () => {
    expect(await downloadPostImage('https://evil.example.com/a.jpg')).toBeNull();
    expect(await downloadPostImage('http://scontent.cdninstagram.com/a.jpg')).toBeNull();
    expect(await downloadPostImage('https://cdninstagram.com.evil.example/a.jpg')).toBeNull();
    expect(await downloadPostImage('http://169.254.169.254/latest/meta-data')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips anything that is not a small image', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>', { headers: { 'content-type': 'text/html' } }));
    expect(await downloadPostImage('https://scontent.cdninstagram.com/a.jpg')).toBeNull();

    fetchMock.mockResolvedValueOnce(new Response('x', { headers: { 'content-type': 'image/jpeg', 'content-length': String(50 * 1024 * 1024) } }));
    expect(await downloadPostImage('https://scontent.cdninstagram.com/a.jpg')).toBeNull();

    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    expect(await downloadPostImage('https://scontent.cdninstagram.com/a.jpg')).toBeNull();
  });
});
