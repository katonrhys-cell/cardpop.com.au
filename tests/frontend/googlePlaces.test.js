import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const GOOGLE_PLACE = {
  id: 'ChIJabc123',
  formattedAddress: '1 Martin Pl, Sydney NSW 2000, Australia',
  addressComponents: [
    { longText: '1', shortText: '1', types: ['street_number'] },
    { longText: 'Martin Place', shortText: 'Martin Pl', types: ['route'] },
    { longText: 'Sydney', shortText: 'Sydney', types: ['locality', 'political'] },
    { longText: 'New South Wales', shortText: 'NSW', types: ['administrative_area_level_1', 'political'] },
    { longText: 'Australia', shortText: 'AU', types: ['country', 'political'] },
    { longText: '2000', shortText: '2000', types: ['postal_code'] },
  ],
};

const withComponents = (overrides) => ({
  ...GOOGLE_PLACE,
  addressComponents: GOOGLE_PLACE.addressComponents
    .filter(c => !overrides.some(o => o.types[0] === c.types[0]))
    .concat(overrides.filter(o => o.longText !== null)),
});

async function loadWithKey(key) {
  vi.resetModules();
  vi.stubEnv('VITE_GOOGLE_PLACES_API_KEY', key);
  return import('../../lib/googlePlaces.js');
}

describe('parsePlace', () => {
  let parsePlace;
  beforeEach(async () => {
    ({ parsePlace } = await loadWithKey(''));
  });
  afterEach(() => vi.unstubAllEnvs());

  it('maps a Google place into the CardPop shipping shape', () => {
    expect(parsePlace(GOOGLE_PLACE)).toEqual({
      address: '1 Martin Place',
      suburb: 'Sydney',
      state: 'NSW',
      postcode: '2000',
      placeId: 'ChIJabc123',
      formatted: '1 Martin Pl, Sydney NSW 2000, Australia',
      verified: true,
    });
  });

  it('prefixes a unit (subpremise) onto the street line', () => {
    const place = withComponents([{ longText: '4', shortText: '4', types: ['subpremise'] }]);
    expect(parsePlace(place).address).toBe('4/1 Martin Place');
  });

  it('falls back to a sublocality when locality is absent', () => {
    const place = withComponents([
      { longText: null, types: ['locality'] },
      { longText: 'Parramatta', shortText: 'Parramatta', types: ['sublocality_level_1'] },
    ]);
    expect(parsePlace(place).suburb).toBe('Parramatta');
  });

  it('returns null for a non-Australian address', () => {
    const place = withComponents([{ longText: 'New Zealand', shortText: 'NZ', types: ['country'] }]);
    expect(parsePlace(place)).toBeNull();
  });

  it('returns null when there is no street (a bare suburb / postcode pick)', () => {
    const place = withComponents([{ longText: null, types: ['route'] }, { longText: null, types: ['street_number'] }]);
    expect(parsePlace(place)).toBeNull();
  });

  it('returns null for an unrecognised state', () => {
    const place = withComponents([{ longText: 'Zed', shortText: 'ZZ', types: ['administrative_area_level_1'] }]);
    expect(parsePlace(place)).toBeNull();
  });

  it('returns null when there are no components at all', () => {
    expect(parsePlace({})).toBeNull();
    expect(parsePlace(null)).toBeNull();
  });
});

describe('without a key', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is disabled and never calls the network', async () => {
    const mod = await loadWithKey('');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(mod.GOOGLE_PLACES_ENABLED).toBe(false);
    expect(await mod.autocompleteAddress('1 Martin')).toEqual([]);
    expect(await mod.resolveSuggestion({ placeId: 'x' })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('with a key', () => {
  let mod;
  let fetchMock;

  beforeEach(async () => {
    mod = await loadWithKey('test-key');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const json = (body, ok = true, status = 200) => ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  it('sends an Australia-only autocomplete request with the key in a header, not the URL', async () => {
    fetchMock.mockResolvedValueOnce(json({
      suggestions: [
        { placePrediction: { placeId: 'p1', text: { text: '1 Martin Place, Sydney NSW' } } },
        { placePrediction: { placeId: 'p2', text: { text: '1 Martin Street, Hurstville NSW' } } },
        { queryPrediction: { text: { text: 'ignored' } } },
      ],
    }));

    const results = await mod.autocompleteAddress('1 Martin');

    expect(results).toEqual([
      { placeId: 'p1', label: '1 Martin Place, Sydney NSW', place: expect.any(Object) },
      { placeId: 'p2', label: '1 Martin Street, Hurstville NSW', place: expect.any(Object) },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(url).not.toContain('test-key');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.input).toBe('1 Martin');
    expect(body.includedRegionCodes).toEqual(['au']);
    expect(body.sessionToken).toEqual(expect.any(String));
  });

  it('skips the network for a query under three characters', async () => {
    expect(await mod.autocompleteAddress('1 ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves a pick through Place Details with a field mask and the same session token', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ suggestions: [{ placePrediction: { placeId: 'ChIJabc123', text: { text: '1 Martin Place' } } }] }))
      .mockResolvedValueOnce(json(GOOGLE_PLACE));

    const [pick] = await mod.autocompleteAddress('1 Martin');
    const resolved = await mod.resolveSuggestion(pick);

    expect(resolved).toMatchObject({ address: '1 Martin Place', suburb: 'Sydney', state: 'NSW', postcode: '2000', verified: true });
    const searchToken = JSON.parse(fetchMock.mock.calls[0][1].body).sessionToken;
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`https://places.googleapis.com/v1/places/ChIJabc123?sessionToken=${searchToken}`);
    expect(init.headers['X-Goog-FieldMask']).toBe('id,formattedAddress,addressComponents');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
  });

  it('starts a fresh session token after a details call', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ suggestions: [] }))
      .mockResolvedValueOnce(json(GOOGLE_PLACE))
      .mockResolvedValueOnce(json({ suggestions: [] }));

    await mod.autocompleteAddress('1 Martin');
    await mod.resolveSuggestion({ placeId: 'ChIJabc123' });
    await mod.autocompleteAddress('2 Martin');

    const first = JSON.parse(fetchMock.mock.calls[0][1].body).sessionToken;
    const second = JSON.parse(fetchMock.mock.calls[2][1].body).sessionToken;
    expect(second).not.toBe(first);
  });

  it("surfaces Google's error message with the HTTP status", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { message: 'API key not valid. Please pass a valid API key.' } }, false, 403));
    await expect(mod.autocompleteAddress('1 Martin')).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('API key not valid'),
    });
  });
});
