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
					if (id.includes('framer-motion')) return 'vendor-motion';
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
