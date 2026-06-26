import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const allDeps = Object.keys(pkg.dependencies || {});

console.warn = () => { };

const logger = createLogger()
const loggerError = logger.error

logger.error = (msg, options) => {
	if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
		return;
	}

	loggerError(msg, options);
}

export default defineConfig({
	optimizeDeps: {
		include: allDeps,
	},
	customLogger: logger,
	plugins: [
		react(),
	],
	server: {
		port: 3000,
		cors: true,
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
		},
		allowedHosts: [
			'.app-preview.com',
			'.app-preview.io',
		],
		fs: {
			strict: true,
			allow: [
				path.resolve(__dirname),
				path.join(path.resolve(__dirname, '../..'), 'node_modules'),
			],
		},
	},
	resolve: {
		extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
		alias: {
			'@': path.resolve(__dirname, '.'),
		},
	},
	build: {
		rollupOptions: {
			external: [
				'@babel/parser',
				'@babel/traverse',
				'@babel/generator',
				'@babel/types',
				'onnxruntime-web',
				'onnxruntime-web/webgpu',
				'react-is'
			],
			output: {
				manualChunks(id) {
					if (!id.includes('node_modules')) return;
					// React core (incl. react/jsx-runtime + scheduler) MUST get its own
					// chunk. Otherwise rolldown co-locates jsx-runtime into whichever
					// vendor chunk it lands in (it was ending up in vendor-motion), and
					// because every component imports jsx-runtime the entry then statically
					// pulls that whole chunk — dragging framer-motion onto the critical
					// path. Keeping React isolated lets framer-motion stay lazy-only.
					// Match the actual react / react-dom / scheduler packages only —
					// NOT scoped packages whose path merely contains "/react/" (e.g.
					// @sentry/react), which a loose includes('/react/') would wrongly
					// pull into vendor-react and drag onto the critical path.
					if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
					// NOTE: framer-motion is deliberately NOT forced into its own manual
					// chunk. When it was, rolldown hoisted a shared react/jsx-runtime
					// helper into that chunk, and because the eager entry needs jsx-runtime
					// it then statically imported the whole framer-motion chunk — putting
					// ~37 KB of animation code on the critical path even though only lazy
					// pages use it. Letting rolldown auto-split framer-motion keeps it off
					// the initial load (loaded on-demand with the pages that animate).
					if (id.includes('lucide-react')) return 'vendor-icons';
					if (id.includes('@radix-ui')) return 'vendor-radix';
					if (id.includes('react-router')) return 'vendor-router';
					if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) return 'vendor-forms';
					if (id.includes('@sentry')) return 'vendor-sentry';
					if (id.includes('date-fns') || id.includes('react-day-picker')) return 'vendor-dates';
					if (id.includes('@stripe') || id.includes('stripe')) return 'vendor-stripe';
				},
			},
		}
	}
});
