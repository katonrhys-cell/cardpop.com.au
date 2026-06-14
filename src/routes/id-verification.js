import { Router } from 'express';
import { ContentBlockType, streamOneShot, uploadImagesToSupabase } from '../api/integrated-ai.js';
import { uploadFiles } from '../middleware/file-upload.js';
import { integratedAiRateLimit } from '../middleware/integrated-ai-rate-limit.js';
import { supabaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use(supabaseAuth);

const requireAuth = (req, res, next) => {
  if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
  next();
};

const IDNameExtractionPrompt = `You are an identity document reader. Extract ONLY the full legal name of the person from this government-issued photo ID (passport, driver's licence, or national identity card).

Return ONLY a JSON object with exactly these fields:
{
  "full_name": "EXACTLY AS PRINTED ON THE DOCUMENT",
  "confidence": "high" | "medium" | "low",
  "document_type": "passport" | "drivers_licence" | "national_id" | "unknown"
}

Rules:
- full_name must be exactly as it appears on the document, preserving capitalisation
- If you cannot read the name clearly, set confidence to "low" with your best attempt
- If no government ID document is visible, return { "full_name": null, "confidence": "low", "document_type": "unknown" }
- Return ONLY valid JSON, no markdown, no code blocks, no explanation`;

async function collectSSEText(stream) {
  return new Promise((resolve, reject) => {
    let text = '';
    stream.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'content' && event.data?.content) text += event.data.content;
          if (event.type === 'error') reject(new Error(event.data?.content || 'AI extraction error'));
        } catch { /* skip malformed lines */ }
      }
    });
    stream.on('end', () => resolve(text));
    stream.on('error', reject);
  });
}

router.post(
  '/extract-name',
  integratedAiRateLimit,
  requireAuth,
  uploadFiles({
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fieldName: 'image',
  }),
  async (req, res) => {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'An ID image is required' });
    }

    try {
      const [imageUrl] = await uploadImagesToSupabase({ images: req.files });

      const userMessage = [
        { type: ContentBlockType.Text, text: 'Extract the full legal name from this government ID document.' },
        { type: ContentBlockType.Image, image: imageUrl },
      ];

      const sseStream = await streamOneShot({ systemPrompt: IDNameExtractionPrompt, userMessage });
      const rawText = await collectSSEText(sseStream);

      const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        return res.json({ extracted_name: null, confidence: 'low', document_type: 'unknown' });
      }

      const result = JSON.parse(jsonMatch[0]);
      return res.json({
        extracted_name: result.full_name ?? null,
        confidence: result.confidence ?? 'low',
        document_type: result.document_type ?? 'unknown',
      });
    } catch (err) {
      console.error('ID name extraction error:', err);
      return res.status(500).json({ error: 'Name extraction failed', extracted_name: null, confidence: 'low' });
    }
  }
);

export default router;
