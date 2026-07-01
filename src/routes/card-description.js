import process from 'node:process';
import { Router } from 'express';
import { CardDescriptionPrompt } from '../constants/prompts.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(supabaseAuth);

const requireAuth = (req, res, next) => {
	if (!req.userId) {
		return res.status(401).json({ error: 'Authentication required' });
	}
	next();
};

// Cheap, fast model — generating prose from already-structured fields is an easy
// task, so the small model is plenty and keeps the call well inside the
// serverless time budget.
const DESCRIPTION_MODEL = 'claude-haiku-4-5-20251001';
const DESCRIPTION_TIMEOUT = 15_000;

// Human-readable labels for the structured card fields we feed the model.
const GRADING_LABELS = {
	raw: 'Raw (ungraded)', psa: 'PSA', bgs: 'Beckett (BGS)',
	cgc: 'CGC', ace: 'ACE', sgc: 'SGC', other: 'Other',
};
const CONDITION_LABELS = {
	mint: 'Mint', near_mint: 'Near Mint', excellent: 'Excellent',
	good: 'Good', light_played: 'Lightly Played', played: 'Played', poor: 'Poor',
};

// Turn the card object into a compact, labelled list the model can ground on.
// Only non-empty fields are included so the model never sees blank prompts.
function buildCardSummary(card = {}) {
	const isGraded = card.gradingCompany && card.gradingCompany !== 'raw';
	const variants = Array.isArray(card.variant)
		? card.variant.filter(Boolean).join(', ')
		: (card.variant || '');

	const lines = [
		['Card name', card.cardName],
		['Game / sport / collection', card.collection],
		['Set / product', card.setName],
		['Card number', card.cardNumber],
		['Year', card.year],
		['Manufacturer / brand', card.manufacturerName],
		['Variant / finish', variants],
		['Parallel', card.parallelName],
		['Serial number', card.serialNumber],
		['Rookie card', card.isRookie ? 'Yes' : ''],
		['Foil', card.isFoil ? 'Yes' : ''],
		['Sealed', card.isSealed ? 'Yes' : ''],
		['Grading company', isGraded ? (GRADING_LABELS[card.gradingCompany] || card.gradingCompany) : ''],
		['Grade', isGraded ? card.grade : ''],
		['Condition', !isGraded ? (CONDITION_LABELS[card.condition] || card.condition) : ''],
	];

	return lines
		.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
		.map(([label, value]) => `- ${label}: ${String(value).trim()}`)
		.join('\n');
}

router.post('/generate', integratedAiRateLimit, requireAuth, async (req, res) => {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		logger.error('[CARD_DESCRIPTION] ANTHROPIC_API_KEY is not set');
		return res.status(503).json({ error: 'Description generation is not configured.' });
	}

	const card = req.body?.card;
	if (!card || typeof card !== 'object') {
		return res.status(400).json({ error: 'Card details are required to generate a description.' });
	}
	if (!card.cardName || !String(card.cardName).trim()) {
		return res.status(400).json({ error: 'A card name is required to generate a description.' });
	}

	const summary = buildCardSummary(card);
	const promptText = `Write the listing description for this trading card using only these details:\n\n${summary}`;

	try {
		const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify({
				model: DESCRIPTION_MODEL,
				max_tokens: 512,
				system: CardDescriptionPrompt,
				messages: [{ role: 'user', content: [{ type: 'text', text: promptText }] }],
			}),
			signal: AbortSignal.timeout(DESCRIPTION_TIMEOUT),
		});

		if (!apiRes.ok) {
			const errBody = await apiRes.text().catch(() => '');
			logger.error(`[CARD_DESCRIPTION] Anthropic API error ${apiRes.status}: ${errBody}`);
			return res.status(502).json({ error: 'Could not generate a description right now. Please try again.' });
		}

		const data = await apiRes.json();
		// Strip any stray surrounding quotes or whitespace the model may add.
		const description = (data.content?.[0]?.text ?? '').trim().replace(/^["']|["']$/g, '').trim();

		if (!description) {
			return res.status(502).json({ error: 'The description came back empty. Please try again.' });
		}

		return res.json({ description });
	} catch (err) {
		logger.error(`[CARD_DESCRIPTION] generate failed: ${err.message}`);
		return res.status(502).json({ error: 'Could not generate a description right now. Please try again.' });
	}
});

export default router;
