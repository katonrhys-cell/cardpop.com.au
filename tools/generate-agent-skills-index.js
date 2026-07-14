#!/usr/bin/env node

// Generates public/.well-known/agent-skills/index.json — the Agent Skills
// Discovery index (Cloudflare/agentskills.io RFC v0.2.0) that lets AI agents
// find the SKILL.md files CardPop publishes.
//
// The index lists each skill with a sha256 digest of its artifact, so agents
// can verify integrity. Computing the digest here at build time (rather than
// hand-writing it) guarantees it always matches the served bytes — edit a
// SKILL.md and the digest updates itself on the next build.

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const SITE_ORIGIN = 'https://cardpop.com.au';
const SKILLS_DIR = path.join(process.cwd(), 'public', '.well-known', 'agent-skills');
const SCHEMA_URL = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

// Minimal YAML front-matter reader: pulls `name:` and `description:` from the
// block between the first two `---` fences. SKILL.md front matter is flat
// key/value, so a full YAML parser would be overkill.
function readFrontMatter(md) {
	const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return {};
	const out = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
	}
	return out;
}

function main() {
	if (!fs.existsSync(SKILLS_DIR)) {
		console.error(`agent-skills: ${SKILLS_DIR} does not exist — nothing to index.`);
		process.exit(0);
	}

	const skills = [];

	for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const skillPath = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
		if (!fs.existsSync(skillPath)) continue;

		const bytes = fs.readFileSync(skillPath);
		const meta = readFrontMatter(bytes.toString('utf8'));
		const digest = 'sha256:' + createHash('sha256').update(bytes).digest('hex');

		skills.push({
			name: meta.name || entry.name,
			type: 'skill-md',
			description: meta.description || '',
			url: `${SITE_ORIGIN}/.well-known/agent-skills/${entry.name}/SKILL.md`,
			digest,
		});
	}

	// Stable ordering so the file diff is deterministic across builds.
	skills.sort((a, b) => a.name.localeCompare(b.name));

	const index = { $schema: SCHEMA_URL, skills };
	const outPath = path.join(SKILLS_DIR, 'index.json');
	fs.writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
	console.error(`agent-skills: wrote ${skills.length} skill(s) to ${outPath}`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) main();

export { main };
