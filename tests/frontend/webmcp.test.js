import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installWebMcp } from '@/lib/webmcp.js';

describe('installWebMcp', () => {
	let originalModelContext;

	beforeEach(() => {
		originalModelContext = navigator.modelContext;
		// jsdom/happy-dom start each test at a known URL.
		window.history.pushState({}, '', '/');
	});

	afterEach(() => {
		if (originalModelContext === undefined) {
			delete navigator.modelContext;
		} else {
			navigator.modelContext = originalModelContext;
		}
		vi.restoreAllMocks();
	});

	it('is a no-op when navigator.modelContext is unavailable', () => {
		delete navigator.modelContext;
		expect(() => installWebMcp()).not.toThrow();
	});

	it('registers tools via provideContext', () => {
		const provideContext = vi.fn();
		navigator.modelContext = { provideContext };

		installWebMcp();

		expect(provideContext).toHaveBeenCalledTimes(1);
		const { tools } = provideContext.mock.calls[0][0];
		const names = tools.map((t) => t.name);
		expect(names).toEqual(['search_cards', 'browse_section', 'get_site_overview']);
		// Every tool must carry the WebMCP-required fields.
		for (const tool of tools) {
			expect(typeof tool.description).toBe('string');
			expect(tool.inputSchema.type).toBe('object');
			expect(typeof tool.execute).toBe('function');
		}
	});

	it('falls back to registerTool when provideContext is absent', () => {
		const registerTool = vi.fn();
		navigator.modelContext = { registerTool };

		installWebMcp();

		expect(registerTool).toHaveBeenCalledTimes(3);
	});

	it('search_cards navigates to the marketplace query and returns text content', () => {
		const provideContext = vi.fn();
		navigator.modelContext = { provideContext };
		installWebMcp();

		const searchTool = provideContext.mock.calls[0][0].tools.find(
			(t) => t.name === 'search_cards'
		);
		const result = searchTool.execute({ query: 'Charizard' });

		expect(window.location.pathname + window.location.search).toBe('/marketplace?q=Charizard');
		expect(result.content[0].type).toBe('text');
		expect(result.content[0].text).toContain('Charizard');
	});

	it('search_cards rejects an empty query without navigating', () => {
		const provideContext = vi.fn();
		navigator.modelContext = { provideContext };
		installWebMcp();

		const searchTool = provideContext.mock.calls[0][0].tools.find(
			(t) => t.name === 'search_cards'
		);
		const result = searchTool.execute({ query: '   ' });

		expect(window.location.pathname).toBe('/');
		expect(result.content[0].text).toMatch(/non-empty/i);
	});

	it('browse_section navigates to a known section and rejects unknown ones', () => {
		const provideContext = vi.fn();
		navigator.modelContext = { provideContext };
		installWebMcp();

		const browseTool = provideContext.mock.calls[0][0].tools.find(
			(t) => t.name === 'browse_section'
		);

		browseTool.execute({ section: 'grading' });
		expect(window.location.pathname).toBe('/grading');

		const bad = browseTool.execute({ section: 'nope' });
		expect(bad.content[0].text).toMatch(/unknown section/i);
	});

	it('get_site_overview returns parseable JSON with sections', () => {
		const provideContext = vi.fn();
		navigator.modelContext = { provideContext };
		installWebMcp();

		const overviewTool = provideContext.mock.calls[0][0].tools.find(
			(t) => t.name === 'get_site_overview'
		);
		const parsed = JSON.parse(overviewTool.execute().content[0].text);

		expect(parsed.name).toBe('CardPop');
		expect(Array.isArray(parsed.sections)).toBe(true);
		expect(parsed.sections.length).toBeGreaterThan(0);
	});
});
