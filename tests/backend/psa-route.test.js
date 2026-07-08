import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockLookupCard = vi.hoisted(() => vi.fn());
const mockLookupImages = vi.hoisted(() => vi.fn());
const mockScraper = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/psaApiClient.js', () => ({
  psaApiClient: { lookupCard: mockLookupCard, lookupImages: mockLookupImages },
}));
vi.mock('../../src/utils/psaScraper.js', () => ({
  fetchPSACertification: mockScraper,
}));
vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import psaRouter from '../../src/routes/psa.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/psa', psaRouter);
  return app;
}
const app = makeApp();

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PSA_API_TOKEN = 'test_token';
});

// A realistic PSA Public API cert payload — note the real field names.
const PSA_CERT = {
  PSACert: {
    CertNumber: '138138870',
    Year: '1999',
    Brand: 'Pokemon Game',
    Category: 'TCG Cards',
    CardNumber: '4',
    Subject: 'Charizard-Holo',
    Variety: '1st Edition',
    LabelType: 'PSA',
    SpecNumber: '12345',
    GradeDescription: 'MINT 9',
    CardGrade: 'MINT 9',
    TotalPopulation: 5000,
    TotalPopulationWithQualifier: 5100,
    PopulationHigher: 1200,
    IsDualCert: false,
    IsPSADNA: false,
  },
};

describe('GET /psa/cert/:certNumber', () => {
  it('maps the real PSA Public API field names into the frontend shape', async () => {
    mockLookupCard.mockResolvedValue(PSA_CERT);
    mockLookupImages.mockResolvedValue([]);

    const res = await request(app).get('/psa/cert/138138870');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      certNumber: '138138870',
      cardYear: '1999',
      cardSet: 'Pokemon Game',
      cardNumber: '4',
      subject: 'Charizard-Holo',
      category: 'TCG Cards',
      variety: '1st Edition',
      labelType: 'PSA',
      grade: 9,
      gradeLabel: 'MINT 9',
      population: 5000,
      populationWithQualifier: 5100,
      popHigher: 1200,
    });
    // Structured title built from the parts (no single "title" field exists).
    expect(res.body.cardTitle).toBe('1999 Pokemon Game Charizard-Holo 1st Edition #4');
  });

  it('merges front/back images from GetImagesByCertNumber', async () => {
    mockLookupCard.mockResolvedValue(PSA_CERT);
    mockLookupImages.mockResolvedValue([
      { IsFrontImage: true, ImageURL: 'https://psa.example/front.jpg' },
      { IsFrontImage: false, ImageURL: 'https://psa.example/back.jpg' },
    ]);

    const res = await request(app).get('/psa/cert/138138870');

    expect(res.status).toBe(200);
    expect(res.body.frontImage).toBe('https://psa.example/front.jpg');
    expect(res.body.backImage).toBe('https://psa.example/back.jpg');
  });

  it('falls back to the scraper when the API returns nothing', async () => {
    mockLookupCard.mockResolvedValue(null);
    mockLookupImages.mockResolvedValue([]);
    mockScraper.mockResolvedValue({ certNumber: '138138870', grade: 9 });

    const res = await request(app).get('/psa/cert/138138870');

    expect(res.status).toBe(200);
    expect(res.body.grade).toBe(9);
    expect(mockScraper).toHaveBeenCalledWith('138138870');
  });

  it('returns 404 when neither the API nor the scraper find the cert', async () => {
    mockLookupCard.mockResolvedValue(null);
    mockLookupImages.mockResolvedValue([]);
    mockScraper.mockResolvedValue(null);

    const res = await request(app).get('/psa/cert/138138870');
    expect(res.status).toBe(404);
  });
});
