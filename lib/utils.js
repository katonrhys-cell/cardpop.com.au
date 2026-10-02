import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge only knows Tailwind's default theme, so it can't tell that our
// brand radii (`rounded-button`, `rounded-input`, …) are border-radius classes.
// Without this, `cn('rounded-input', 'rounded-full')` keeps both and the CSS
// source order decides — and the brand radii are emitted last, so every
// `rounded-full` / `rounded-xl` override on Input, Button, Card and Badge was
// silently ignored. Keep this in sync with `tailwind.config.js`.
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			borderRadius: ['button', 'input', 'card', 'pill'],
		},
		classGroups: {
			'min-h': [{ 'min-h': ['touch'] }],
			'min-w': [{ 'min-w': ['touch'] }],
		},
	},
});

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}
