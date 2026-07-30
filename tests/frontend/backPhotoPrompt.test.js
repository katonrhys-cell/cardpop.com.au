import { describe, it, expect } from 'vitest';
import {
	missingBackFields,
	shouldPromptForBack,
	backPhotoPromptText,
} from '../../utils/backPhotoPrompt.js';

// A complete read — nothing missing that a back photo would recover.
const complete = { releaseYear: '2025-26', cardNumber: '126', name: 'Austin Reaves' };

describe('missingBackFields', () => {
	it('reports nothing for a complete read', () => {
		expect(missingBackFields(complete)).toEqual([]);
	});

	it('reports the year when only the year is missing', () => {
		expect(missingBackFields({ ...complete, releaseYear: '' })).toEqual(['year']);
	});

	it('reports the card number when only the number is missing', () => {
		expect(missingBackFields({ ...complete, cardNumber: '' })).toEqual(['card number']);
	});

	it('reports both when both are missing', () => {
		expect(missingBackFields({ releaseYear: '', cardNumber: '' })).toEqual(['year', 'card number']);
	});

	it('treats whitespace and undefined as missing', () => {
		expect(missingBackFields({ releaseYear: '   ', cardNumber: undefined })).toEqual(['year', 'card number']);
	});

	it('ignores fields a back photo would not recover', () => {
		// A missing name is a front-photo problem — it must not trigger this.
		expect(missingBackFields({ ...complete, name: '', cardSetName: '' })).toEqual([]);
	});

	it('returns nothing for a null read', () => {
		expect(missingBackFields(null)).toEqual([]);
		expect(missingBackFields(undefined)).toEqual([]);
	});
});

describe('shouldPromptForBack', () => {
	it('prompts on a front-only read missing the year', () => {
		expect(shouldPromptForBack({
			scanResult: { ...complete, releaseYear: '' }, analysedImageCount: 1,
		})).toBe(true);
	});

	it('stays quiet when the read is complete', () => {
		expect(shouldPromptForBack({ scanResult: complete, analysedImageCount: 1 })).toBe(false);
	});

	it('stays quiet when a back was already sent', () => {
		// The field is still missing, but the back is evidently not the fix — this
		// is the case that would otherwise send a seller to re-shoot for nothing.
		expect(shouldPromptForBack({
			scanResult: { ...complete, releaseYear: '', cardNumber: '' }, analysedImageCount: 2,
		})).toBe(false);
	});

	it('stays quiet when no read has happened', () => {
		expect(shouldPromptForBack({ scanResult: null, analysedImageCount: 1 })).toBe(false);
	});

	it('prompts when the image count is unknown', () => {
		// Absent/NaN must not be read as "many images" — that would silence the
		// prompt in exactly the case it is for.
		expect(shouldPromptForBack({ scanResult: { releaseYear: '', cardNumber: '' } })).toBe(true);
	});
});

describe('backPhotoPromptText', () => {
	it('names a single missing field', () => {
		expect(backPhotoPromptText(['year'])).toContain('fill in the year');
	});

	it('joins two fields readably', () => {
		expect(backPhotoPromptText(['year', 'card number'])).toContain('fill in the year and card number');
	});

	it('is empty when nothing is missing', () => {
		expect(backPhotoPromptText([])).toBe('');
		expect(backPhotoPromptText(undefined)).toBe('');
	});
});
