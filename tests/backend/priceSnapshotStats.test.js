import { describe, it, expect } from 'vitest';
import {
  isGradedTitle, isNotTheCard, median, priceStats, summariseListings, withinMedianFence,
} from '../../utils/priceSnapshotStats.js';

const L = (priceAud, title = 'card') => ({ priceAud, title });

describe('price snapshot listing filters', () => {
  it('recognises graded titles without catching Tag Team cards', () => {
    for (const t of ['Charizard PSA 10', 'Curry BGS 9.5', 'Beckett 9 rookie', 'slabbed rookie', 'GEM MINT 10 Zoro', 'TAG 10 Umbreon', 'CGC pristine']) {
      expect(isGradedTitle(t)).toBe(true);
    }
    for (const t of ['Pikachu & Zekrom Tag Team GX', 'Charizard near mint', 'Curry rookie raw', '']) {
      expect(isGradedTitle(t)).toBe(false);
    }
  });

  it('flags listings that are not one genuine copy', () => {
    for (const t of ['MJ Fleer REPRINT', 'Jordan RP card', 'Charizard proxy', 'custom art Zoro', 'Lot of 10 rookies', 'bulk bundle', 'You Pick singles', '23kt gold Jordan', 'Not Authentic Charizard']) {
      expect(isNotTheCard(t)).toBe(true);
    }
    for (const t of ['1986 Fleer Michael Jordan #57', 'Digimon Digital Monsters Agumon', 'Lotad 003/100', 'Charizard Base Set holo']) {
      expect(isNotTheCard(t)).toBe(false);
    }
  });

  it('does not hold a term against a listing when the tracked card itself uses it', () => {
    expect(isNotTheCard('1986 Fleer Sticker Michael Jordan #8')).toBe(true);
    expect(isNotTheCard('1986 Fleer Sticker Michael Jordan #8', 'Michael Jordan 1986 Fleer Sticker')).toBe(false);
    // A different junk term in the same title still counts.
    expect(isNotTheCard('1986 Fleer Sticker Michael Jordan reprint', 'Michael Jordan 1986 Fleer Sticker')).toBe(true);
  });

  it('fences a group around its median only when it has enough listings', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(withinMedianFence([L(100), L(110), L(2000)]).map((l) => l.priceAud)).toEqual([100, 110]);
    expect(withinMedianFence([L(5), L(100), L(110)]).map((l) => l.priceAud)).toEqual([100, 110]);
    // Two listings can't say which one is the outlier.
    expect(withinMedianFence([L(100), L(2000)])).toHaveLength(2);
  });

  it('drops raw listings priced above every graded copy', () => {
    const out = summariseListings([
      L(185, 'Daicos rookie'), L(2500, 'Daicos rookie'),
      L(470, 'Daicos PSA 9'), L(800, 'Daicos PSA 10'), L(1300, 'Daicos BGS 9.5'),
    ]);
    expect(out.rawStats).toMatchObject({ avg: 185, count: 1 });
    expect(out.gradedStats.count).toBe(3);
    expect(out.dropped.aboveGraded).toBe(1);
  });

  it('leaves raw alone when there are too few graded listings to compare against', () => {
    const out = summariseListings([L(100, 'raw'), L(900, 'raw'), L(500, 'PSA 9'), L(600, 'PSA 10')]);
    expect(out.rawStats.count).toBe(2);
    expect(out.dropped).toEqual({ notTheCard: 0, outlier: 0, aboveGraded: 0, belowGraded: 0 });
  });

  it('reports nothing rather than inventing a figure when every listing is dropped', () => {
    const out = summariseListings([L(5, 'reprint'), L(8, 'proxy')]);
    expect(out.rawStats).toEqual({ avg: null, min: null, max: null, count: 0 });
    expect(out.gradedStats.count).toBe(0);
    expect(out.dropped.notTheCard).toBe(2);
  });

  it('trims the tails once there are eight prices', () => {
    expect(priceStats([10, 20])).toEqual({ avg: 15, min: 10, max: 20, count: 2 });
    expect(priceStats([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])).toEqual({ avg: 15.5, min: 12, max: 19, count: 8 });
  });
});
