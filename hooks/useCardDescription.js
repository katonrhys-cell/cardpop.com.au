import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiServerClient } from '@/lib/apiServerClient.js';
import { useIsMounted } from '@/hooks/useIsMounted.js';

// Generates a unique, SEO-enhanced listing description from the card details the
// user has already populated. Returns the generated text (and exposes a loading
// flag) so the caller can drop it straight into the description/notes field.
export function useCardDescription() {
	const [isGenerating, setIsGenerating] = useState(false);
	const isMounted = useIsMounted();

	const generateDescription = useCallback(async (card) => {
		if (!card?.cardName?.trim()) {
			toast.error('Add a card name first, then generate a description.');
			return null;
		}

		setIsGenerating(true);
		try {
			const response = await apiServerClient.fetch('/card-description/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card }),
			});

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data?.error || 'Could not generate a description. Please try again.');
			}
			if (!data?.description) {
				throw new Error('The description came back empty. Please try again.');
			}

			toast.success('Description generated — review and tweak it before saving.');
			return data.description;
		} catch (err) {
			toast.error(err.message || 'Could not generate a description. Please try again.');
			return null;
		} finally {
			if (isMounted()) setIsGenerating(false);
		}
	}, [isMounted]);

	return { generateDescription, isGenerating };
}
