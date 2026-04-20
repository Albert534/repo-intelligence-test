/**
 * pr_service.js — Fully Automated PR Checker
 * ─────────────────────────────────────────────
 * What this does automatically (zero manual steps):
 *
 *  1. Webhook lands → PR job pushed to BullMQ queue (instant response)
 *  2. Worker picks up job → blocks merge button immediately via pending status
 *  3. Redis cache checked — if SHA already analysed, results served instantly
 *  4. Diff fetched → noisy files stripped (locks, snapshots, minified, generated)
 *  5. Regex pre-scan + keyword pre-filter (free — zero API cost)
 *  6. [Voyage AI DISABLED — see commented section below]
 *  7. Results cached in Redis (TTL 24h) so /recheck costs nothing
 *  8. 🆕 applyAllFixes() runs FIRST — patches every file on disk before anything
 *     is posted to GitHub. Zero AI calls. All files written in parallel (<30ms).
 *  9. Inline review comments posted (hybrid: individual for critical, combined for warn/info)
 * 10. GitHub review, labels, status posted in parallel
 * 11. Auto-closes critical PRs OR auto-merges clean PRs
 * 12. Per-repo rate limiting via Redis — prevents cost spikes
 *
 * Fix All (one-click, exported):
 *   exports.applyAllFixes(findings, repoRoot)
 *   POST /fix-all  { sha, repoRoot }
 *   — Groups findings by file, reads once, applies all buildFix() results, writes back.
 *   — 10 concurrent file ops via p-limit. Typical wall time <30ms for a 20-file PR.
 *   — Called internally at Step 8 so fixes are on disk before the review posts.
 */

'use strict';

const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');
const Redis = require('ioredis');
const pLimit = require('p-limit');
const { getPatternsForDiff } = require('../patterns');
const { fixFindings } = require('./ollamaService');

// ─── Fix output cleaner ───────────────────────────────────────────────────────
// buildFixBlock() (helper.js) returns a decorated block:
//   // ❌ What you wrote:      ← decoration
//   <old code>                 ← decoration
//                              ← blank
//   // ✅ Do this instead:     ← marker
//   <fixed code>               ← ONLY this part should be written to disk
//
// extractFixedCode finds the marker, discards everything before it, strips any
// remaining decoration comment lines, and returns ONLY the clean fixed code.
// A small watermark is appended to the first line so reviewers know it was
// auto-suggested.

const WATERMARK = '// ✏️ repo-intel';

// All known markers — covers both helper.js variants and any legacy text.
const FIX_MARKERS = [
	'✅ Do this instead:',
	'✅ Fix:',
];

// Decoration-only lines we must strip (produced by buildFixBlock / comments).
// Matches lines whose non-whitespace content is ONLY a comment + ❌/✅ text.
const DECORATION_LINE_RE = /^\s*(\/\/|#|--)\s*(❌|✅|⚠️)/;

function extractFixedCode(rawFix) {
	if (!rawFix) return rawFix;

	// 1. Find the earliest marker and take only what follows it.
	let cleanCode = null;
	for (const marker of FIX_MARKERS) {
		const idx = rawFix.indexOf(marker);
		if (idx !== -1) {
			const candidate = rawFix.slice(idx + marker.length).trim();
			if (cleanCode === null || idx < rawFix.indexOf(cleanCode)) {
				cleanCode = candidate;
			}
			break; // use the first marker found
		}
	}

	// 2. If no marker found, treat the whole string as already-clean code
	//    (e.g. plain Ollama output that followed the prompt instructions).
	if (cleanCode === null) {
		cleanCode = rawFix.trim();
	}

	// 3. Strip any residual decoration lines (// ❌ …, // ✅ …, # ⚠️ … etc.)
	const codeLines = cleanCode
		.split('\n')
		.filter((line) => !DECORATION_LINE_RE.test(line));

	// 4. Remove leading / trailing blank lines left after stripping decorations.
	while (codeLines.length && !codeLines[0].trim()) codeLines.shift();
	while (codeLines.length && !codeLines[codeLines.length - 1].trim()) codeLines.pop();

	if (!codeLines.length) return rawFix.trim(); // safety: never return empty

	// 5. Append watermark to the FIRST code line so it's visible without scrolling.
	codeLines[0] = codeLines[0] + '  ' + WATERMARK;
	return codeLines.join('\n');
}

// ─── Config ───────────────────────────────────────────────────────────────────

// const VOYAGE_API        = 'https://api.voyageai.com/v1/rerank';  // DISABLED
// const VOYAGE_MODEL      = 'rerank-2.5-lite';                      // DISABLED
// const PASS_A_CUTOFF     = 0.2;                                    // DISABLED
// const PASS_A_MAX_CHARS  = 3_000;                                  // DISABLED
// const PASS_B_MAX_CHUNKS = 5;                                      // DISABLED
// const voyageLimit       = pLimit(8);                              // DISABLED

const RELEVANCE_CUTOFF = 0.4;
const MAX_DIFF_CHARS = 12_000;
const CHUNK_SIZE = 2_000;
const CHUNK_OVERLAP = 50;
const MAX_CHUNKS = 20;

// Fix-all: 10 concurrent file read/write ops
const fixLimit = pLimit(10);

// Rate limit: max pattern-scan calls per repo per hour
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_S = 3_600;

// Redis cache TTL (24 h)
const CACHE_TTL_S = 86_400;

// Repo root for applyAllFixes — override via REPO_ROOT env or pass directly
const DEFAULT_REPO_ROOT = process.env.REPO_ROOT ?? process.cwd();

// Noisy file patterns stripped before analysis
const NOISY_FILE_PATTERNS = [
	/^diff --git.+\.(lock|snap|min\.js|min\.css|pb\.js|pb\.ts|pb\.go|d\.ts)(\s|$)/m,
	/^diff --git.+(__snapshots__|\.yarn\/|\.pnp\.|dist\/|build\/|coverage\/|\.next\/|\.nuxt\/)/m,
	/^diff --git.+\/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Gemfile\.lock|Cargo\.lock|poetry\.lock)/m,
];

// ─── Redis setup (cache only — no queue) ─────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

const redis = new Redis(REDIS_URL, {
	maxRetriesPerRequest: null,
	enableReadyCheck: false,
	lazyConnect: true,
});

redis.on('connect', () => console.log(`[PR-Service] Redis connected: ${REDIS_URL}`));
redis.on('error',   (err) => console.warn(`[PR-Service] Redis error (cache degraded): ${err.message}`));

// Connect eagerly so we know immediately if Redis is down
redis.connect().catch((err) =>
	console.warn(`[PR-Service] Redis initial connect failed — cache disabled: ${err.message}`),
);

// ─── Redis helpers ────────────────────────────────────────────────────────────

// ─── Dismiss previous bot reviews ────────────────────────────────────────────

async function dismissPreviousReviews(repo, prNumber, token) {
	try {
		// 1. Get all reviews on this PR
		const reviews = await githubRequest(
			`https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews`,
			'GET',
			undefined,
			token,
		);

		if (!reviews?.length) return;

		// 2. Find bot's own REQUEST_CHANGES reviews that are still active
		const { data: botUser } = await fetch('https://api.github.com/user', {
			headers: GITHUB_HEADERS(token),
		})
			.then((r) => r.json())
			.then((data) => ({ data }));

		const toDissmiss = reviews.filter(
			(r) =>
				r.state === 'CHANGES_REQUESTED' && r.user?.login === botUser?.login,
		);

		// 3. Dismiss each one
		await Promise.all(
			toDissmiss.map((review) =>
				githubRequest(
					`https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews/${review.id}/dismissals`,
					'PUT',
					{ message: '🔄 Dismissed by re-check — new analysis in progress.' },
					token,
				).catch((err) =>
					console.warn(
						`[PR-Service] Could not dismiss review ${review.id}: ${err.message}`,
					),
				),
			),
		);

		if (toDissmiss.length > 0) {
			console.log(
				`[PR-Service] Dismissed ${toDissmiss.length} previous review(s)`,
			);
		}
	} catch (err) {
		console.warn(`[PR-Service] dismissPreviousReviews failed: ${err.message}`);
	}
}

async function checkRateLimit(repo) {
	const key = `rl:scan:${repo}`;
	const count = await redis.incr(key);
	if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_S);
	if (count > RATE_LIMIT_MAX) {
		console.warn(
			`[PR-Service] Rate limit hit for ${repo} (${count}/${RATE_LIMIT_MAX}/h)`,
		);
		return false;
	}
	return true;
}

async function cacheSet(sha, result) {
	const serializable = {
		verdict: result.verdict,
		summary: result.summary,
		issueIds: result.issues.map((i) => i.id),
		issueScores: Object.fromEntries(result.issues.map((i) => [i.id, i.score])),
		findings: result.findings.map(({ issue, path, position, lineContent }) => ({
			issueId: issue.id,
			path,
			position,
			lineContent,
		})),
	};
	await redis.set(
		`pr:result:${sha}`,
		JSON.stringify(serializable),
		'EX',
		CACHE_TTL_S,
	);
}

async function cacheGet(sha, allPatterns) {
	const raw = await redis.get(`pr:result:${sha}`);
	if (!raw) return null;

	const cached = JSON.parse(raw);
	const patternMap = Object.fromEntries(
		(allPatterns ?? []).map((p) => [p.id, p]),
	);

	const issues = (cached.issueIds ?? [])
		.map((id) => {
			const pattern = patternMap[id];
			if (!pattern) {
				console.warn(
					`[PR-Service] Cache re-hydration: pattern "${id}" not found — skipping`,
				);
				return null;
			}
			return { ...pattern, score: cached.issueScores?.[id] ?? 0 };
		})
		.filter(Boolean);

	const findings = (cached.findings ?? [])
		.map(({ issueId, path, position, lineContent }) => {
			const issue = issues.find((i) => i.id === issueId);
			if (!issue) return null;
			return { issue, path, position, lineContent };
		})
		.filter(Boolean);

	return { issues, findings, verdict: cached.verdict, summary: cached.summary };
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

const GITHUB_HEADERS = (token) => ({
	Authorization: `Bearer ${token}`,
	Accept: 'application/vnd.github+json',
	'Content-Type': 'application/json',
});

async function githubRequest(url, method = 'GET', body, token) {
	const res = await fetch(url, {
		method,
		headers: GITHUB_HEADERS(token),
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`GitHub ${method} ${url} → ${res.status}: ${err}`);
	}
	return res.status === 204 ? null : res.json();
}

async function getDiff(diffUrl, token) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 30_000); // 30-second hard timeout
	try {
		const res = await fetch(diffUrl, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'pr-checker/3.0',
				Accept: 'application/vnd.github.v3.diff',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
		});
		if (!res.ok) throw new Error(`Failed to fetch diff: ${res.status} ${res.statusText}`);
		const text = await res.text();
		return text.length > MAX_DIFF_CHARS
			? text.slice(0, MAX_DIFF_CHARS) + '\n\n[...diff truncated...]'
			: text;
	} catch (err) {
		if (err.name === 'AbortError') {
			throw new Error('getDiff timed out after 30 s — GitHub did not respond');
		}
		throw err;
	} finally {
		clearTimeout(timer);
	}
}

// ─── Diff utilities ───────────────────────────────────────────────────────────

function stripNoisyFiles(diff) {
	const sections = diff.split(/(?=^diff --git)/m);
	const before = sections.length;
	const filtered = sections.filter(
		(section) => !NOISY_FILE_PATTERNS.some((p) => p.test(section)),
	);
	const removed = before - filtered.length;
	if (removed > 0)
		console.log(
			`[PR-Service] Stripped ${removed} noisy file section(s) from diff`,
		);
	return filtered.join('');
}

function chunkDiff(diff) {
	const chunks = [];
	for (let i = 0; i < diff.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
		chunks.push(diff.slice(i, i + CHUNK_SIZE));
		if (chunks.length >= MAX_CHUNKS) break;
	}
	return chunks.length > 0 ? chunks : [diff];
}

// ─── Stage 1: Regex pre-scan ──────────────────────────────────────────────────

function cheapPreScan(diff, patterns) {
	const matched = patterns.filter((p) => p.regex?.test(diff)).map((p) => p.id);
	if (matched.length) {
		console.log('[PR-Service] Pre-scan matched:', matched.join(', '));
		return true;
	}
	return false;
}

// ─── Stage 1b: Keyword pre-filter ────────────────────────────────────────────

function filterPatternsByKeyword(diff, patterns) {
	const lowerDiff = diff.toLowerCase();
	const candidates = patterns.filter((pattern) => {
		if (!pattern.query) return true;
		const keywords = pattern.query
			.toLowerCase()
			.split(/\s+/)
			.filter((w) => w.length >= 4);
		if (keywords.length === 0) return true;
		return keywords.some((kw) => lowerDiff.includes(kw));
	});
	const skipped = patterns.length - candidates.length;
	if (skipped > 0)
		console.log(
			`[PR-Service] Keyword pre-filter: skipped ${skipped}/${patterns.length} pattern(s) with no keyword overlap`,
		);
	return candidates;
}

// ─── [VOYAGE AI — DISABLED] ───────────────────────────────────────────────────
//
// Two-pass Voyage reranking replaced by direct regex matching + buildFix().
// Functions preserved below for reference — NOT called anywhere.
//
// async function voyageRerank(query, documents) { ... }
// function  topChunksForPattern(chunks, pattern, n) { ... }
// async function rerankWithVoyage(diff, patterns) { ... }
//
// To re-enable: restore calls in runAnalysis() Step 5b/6 and uncomment
// VOYAGE_API / VOYAGE_MODEL / PASS_A_CUTOFF / PASS_A_MAX_CHARS /
// PASS_B_MAX_CHUNKS / voyageLimit at the top of this file.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Stage 2: Find exact diff positions ──────────────────────────────────────

function findDiffPositions(diff, issues) {
	const lines = diff.split('\n');
	const findings = [];
	const seen = new Set(); // dedup key: "file:position:issueId"
	let currentFile = null;
	let diffPosition = 0;

	for (const line of lines) {
		if (line.startsWith('diff --git')) {
			currentFile = line.match(/b\/(.+)$/)?.[1] ?? null;
			diffPosition = 0;
			continue;
		}
		if (line.startsWith('@@')) {
			diffPosition = 0;
			continue;
		}
		if (!line.startsWith('-')) diffPosition++;

		if (line.startsWith('+') && currentFile) {
			const content = line.slice(1);
			for (const issue of issues) {
				const dedupKey = `${currentFile}:${diffPosition}:${issue.id}`;
				if (issue.regex?.test(content) && !seen.has(dedupKey)) {
					seen.add(dedupKey);
					findings.push({
						issue,
						path: currentFile,
						position: diffPosition,
						lineContent: content.trim(),
					});
				}
			}
		}
	}
	return findings;
}

// ─── 🆕 Stage 3: applyAllFixes — RUNS FIRST, BEFORE GITHUB POSTING ───────────
//
// Applies every buildFix() result directly to files on disk.
// Called inside runAnalysis() at Step 8 — before postReview(), before labels,
// before status — so by the time GitHub gets anything, the repo is already clean.
//
// Algorithm (optimised for speed):
//   1. Group findings by file path  → one fs.readFile per file, not per finding
//   2. For each file, find each bad line by content match → apply buildFix()
//   3. Write the file back once with all fixes batched into it
//   4. All files processed concurrently via fixLimit(10)
//
// Indentation is preserved: stripped from lineContent during diff parsing,
// recovered from the actual file line before writing.
//
// @param {Array}  findings  — from findDiffPositions(); must have issue.buildFix
// @param {string} repoRoot  — absolute path to the checked-out repo on disk
// @returns {Promise<Array>} — [{ path, position, original, fixed, applied, error }]

async function applyAllFixes(
	findings,
	repoRoot = DEFAULT_REPO_ROOT,
	githubOptions = null,
) {
	if (!findings.length) {
		console.log('[Fix-All] No findings — nothing to apply');
		return [];
	}

	// ── Remote mode: GitHub API (webhook /fix-all comment) ───────────────────
	if (githubOptions?.repo && githubOptions?.token) {
		const { repo, token, branch } = githubOptions;
		console.log(
			`[Fix-All] Remote mode — committing via GitHub API to ${repo}@${branch}`,
		);
		const start = Date.now();

		const byFile = new Map();
		for (const f of findings) {
			if (!byFile.has(f.path)) byFile.set(f.path, []);
			byFile.get(f.path).push(f);
		}

		const results = [];

		await Promise.all(
			[...byFile.entries()].map(([filePath, fileFindings]) =>
				fixLimit(async () => {
					try {
						const fileData = await githubRequest(
							`https://api.github.com/repos/${repo}/contents/${filePath}` +
								(branch ? `?ref=${branch}` : ''),
							'GET',
							undefined,
							token,
						);

						const originalContent = Buffer.from(
							fileData.content,
							'base64',
						).toString('utf8');
						let lines = originalContent.split('\n');
						const fileSha = fileData.sha;

						for (const { issue, lineContent, position } of fileFindings) {
							const lineIdx = lines.findIndex(
								(l) => l.trim() === lineContent.trim(),
							);

							if (lineIdx === -1) {
								console.warn(
									`[Fix-All] Line not found in ${filePath}: "${lineContent.slice(0, 60)}"`,
								);
								results.push({
									path: filePath,
									position,
									original: lineContent,
									fixed: null,
									applied: false,
									error: 'Line not found (may already be fixed)',
								});
								continue;
							}

							const fixed = extractFixedCode(issue.buildFix(lineContent));
							const indent = lines[lineIdx].match(/^(\s*)/)[1];
							const fixLines = fixed.trimStart().split('\n');
							// splice replaces 1 bad line with N fixed lines; subsequent
							// findIndex() calls still work because they match by content.
							lines.splice(
								lineIdx, 1,
								...fixLines.map((fl, i) => i === 0 ? indent + fl.trimStart() : indent + fl),
							);

							console.log(
								`[Fix-All] ${filePath}:${lineIdx + 1} "${lineContent.slice(0, 50)}" -> "${fixed.slice(0, 50)}"`,
							);
							results.push({
								path: filePath,
								position,
								original: lineContent,
								fixed,
								applied: true,
								error: null,
							});
						}

						const newContent = Buffer.from(lines.join('\n')).toString('base64');
						const appliedCount = results.filter(
							(r) => r.path === filePath && r.applied,
						).length;

						if (appliedCount > 0) {
							await githubRequest(
								`https://api.github.com/repos/${repo}/contents/${filePath}`,
								'PUT',
								{
									message: `fix: auto-fix ${appliedCount} issue(s) in ${filePath} [pr-checker]`,
									content: newContent,
									sha: fileSha,
									...(branch ? { branch } : {}),
								},
								token,
							);
							console.log(
								`[Fix-All] Committed ${appliedCount} fix(es) to ${filePath}`,
							);
						}
					} catch (err) {
						console.warn(`[Fix-All] Failed for ${filePath}: ${err.message}`);
						for (const f of fileFindings) {
							results.push({
								path: filePath,
								position: f.position,
								original: f.lineContent,
								fixed: null,
								applied: false,
								error: err.message,
							});
						}
					}
				}),
			),
		);

		const applied = results.filter((r) => r.applied).length;
		const failed = results.length - applied;
		console.log(
			`[Fix-All] Done — ${applied} applied, ${failed} failed — ${Date.now() - start}ms`,
		);
		return results;
	}

	// ── Local disk mode: GitHub Actions workflow (run-fix-all.js) ────────────
	console.log(`[Fix-All] Local mode — writing to disk at ${repoRoot}`);
	const start = Date.now();

	const byFile = new Map();
	for (const f of findings) {
		if (!byFile.has(f.path)) byFile.set(f.path, []);
		byFile.get(f.path).push(f);
	}

	const results = [];

	await Promise.all(
		[...byFile.entries()].map(([filePath, fileFindings]) =>
			fixLimit(async () => {
				const absPath = path.join(repoRoot, filePath);

				let lines;
				try {
					lines = (await fs.readFile(absPath, 'utf8')).split('\n');
				} catch (err) {
					console.warn(`[Fix-All] Cannot read ${filePath}: ${err.message}`);
					for (const f of fileFindings) {
						results.push({
							path: filePath,
							position: f.position,
							original: f.lineContent,
							fixed: null,
							applied: false,
							error: `Read error: ${err.message}`,
						});
					}
					return;
				}

				for (const { issue, lineContent, position } of fileFindings) {
					const lineIdx = lines.findIndex(
						(l) => l.trim() === lineContent.trim(),
					);

					if (lineIdx === -1) {
						console.warn(
							`[Fix-All] Line not found in ${filePath}: "${lineContent.slice(0, 60)}"`,
						);
						results.push({
							path: filePath,
							position,
							original: lineContent,
							fixed: null,
							applied: false,
							error: 'Line not found (may already be fixed)',
						});
						continue;
					}

					const fixed = issue.buildFix(lineContent);
					const indent = lines[lineIdx].match(/^(\s*)/)[1];
					lines[lineIdx] = indent + fixed.trimStart();

					console.log(
						`[Fix-All] ${filePath}:${lineIdx + 1} "${lineContent.slice(0, 50)}" -> "${fixed.slice(0, 50)}"`,
					);
					results.push({
						path: filePath,
						position,
						original: lineContent,
						fixed,
						applied: true,
						error: null,
					});
				}

				try {
					await fs.writeFile(absPath, lines.join('\n'), 'utf8');
					console.log(
						`[Fix-All] Wrote ${fileFindings.length} fix(es) to ${filePath}`,
					);
				} catch (err) {
					console.warn(
						`[Fix-All] Write failed for ${filePath}: ${err.message}`,
					);
					for (const r of results.filter((r) => r.path === filePath)) {
						r.applied = false;
						r.error = `Write error: ${err.message}`;
					}
				}
			}),
		),
	);

	const applied = results.filter((r) => r.applied).length;
	const failed = results.length - applied;
	console.log(
		`[Fix-All] Done — ${applied} applied, ${failed} failed — ${Date.now() - start}ms`,
	);
	return results;
}
// ─── Stage 4: Post inline review comments ────────────────────────────────────

const SEVERITY_ICON = { critical: '🔴', warning: '🟡', info: '🔵' };
const CATEGORY_ICON = {
	security: '🔐',
	error: '💥',
	syntax: '🔤',
	structure: '📂',
	style: '🎨',
	performance: '⚡',
};

async function postReview(
	repo,
	prNumber,
	commitSha,
	issues,
	findings,
	verdict,
	token,
	fixResults = [],
) {
	const comments = [];

	// ── Critical — individual inline comment per finding ──────────────────────
	for (const { issue, path, position, lineContent } of findings.filter(
		(f) => f.issue.severity === 'critical',
	)) {
		const wasApplied = fixResults.some(
			(r) =>
				r.applied &&
				r.path === path &&
				r.original.trim() === lineContent.trim(),
		);
		comments.push({
			path,
			position,
			body: [
				`${SEVERITY_ICON.critical} **CRITICAL** · ${CATEGORY_ICON[issue.category]} \`${issue.category}\``,
				'',
				`**${issue.message}**`,
				'',
				'```javascript',
				extractFixedCode(issue.buildFix(lineContent)),
				'```',
				'',
				`> 💡 ${issue.suggestion}`,
				'',
				wasApplied ?
					'✅ _Auto-fix already applied to this file on disk._'
				:	'_Resolve this conversation once the line above is fixed._',
			].join('\n'),
		});
	}

	// ── Warnings / info — combined per-file comment ───────────────────────────
	const byFile = {};
	for (const f of findings.filter((f) => f.issue.severity !== 'critical')) {
		(byFile[f.path] ??= {})[f.position] ??= [];
		byFile[f.path][f.position].push(f);
	}
	for (const [filePath, posMap] of Object.entries(byFile)) {
		const positions = Object.keys(posMap)
			.map(Number)
			.sort((a, b) => a - b);
		const lines = [
			`### 🔍 Warnings & notes in \`${filePath.split('/').pop()}\``,
			'',
		];
		for (const pos of positions) {
			const fs = posMap[pos];
			lines.push(
				`**Line ~${pos}** — \`${fs[0].lineContent.slice(0, 80)}${fs[0].lineContent.length > 80 ? '…' : ''}\``,
				'',
			);
			for (const { issue, lineContent } of fs) {
				const wasApplied = fixResults.some(
					(r) =>
						r.applied &&
						r.path === filePath &&
						r.original.trim() === lineContent.trim(),
				);
				lines.push(
					`${SEVERITY_ICON[issue.severity]} **${issue.severity.toUpperCase()}** · ${CATEGORY_ICON[issue.category]} \`${issue.category}\` — ${issue.message}`,
					'',
					'```javascript',
					extractFixedCode(issue.buildFix(lineContent)),
					'```',
					'',
					`> 💡 ${issue.suggestion}`,
					'',
					wasApplied ?
						'✅ _Auto-fix already applied to this file on disk._'
					:	'',
					'---',
					'',
				);
			}
		}
		comments.push({
			path: filePath,
			position: positions[positions.length - 1],
			body: lines.join('\n').trimEnd(),
		});
	}

	// ── Review body ───────────────────────────────────────────────────────────
	const appliedCount = fixResults.filter((r) => r.applied).length;
	const failedCount = fixResults.filter((r) => !r.applied && r.error).length;

	const summaryLines = [
		verdict === 'fail' ?
			'## 🚨 PR Blocked — Critical issues must be fixed before merging'
		: verdict === 'warn' ?
			'## ⚠️ PR has warnings — please review before merging'
		:	'## ✅ All checks passed — auto-merging',
		'',
	];

	if (appliedCount > 0) {
		summaryLines.push(
			`> ⚡ **${appliedCount} fix(es) auto-applied to disk** before this review was posted.` +
				(failedCount > 0 ?
					` (${failedCount} could not be applied — see inline comments)`
				:	''),
			'',
		);
	}

	if (issues.length > 0) {
		summaryLines.push(
			`Regex scan surfaced **${issues.length}** issue(s) across your diff:`,
			'',
			'| Auto-fixed | Severity | Category | Issue |',
			'|------------|----------|----------|-------|',
		);
		for (const i of issues) {
			const fixed = fixResults.some(
				(r) => r.applied && r.original && i.regex?.test(r.original),
			);
			summaryLines.push(
				`| ${fixed ? '✅ yes' : '⏳ pending'} | ${SEVERITY_ICON[i.severity]} ${i.severity} | ${CATEGORY_ICON[i.category]} ${i.category} | ${i.message} |`,
			);
		}
		summaryLines.push(
			'',
			'> Inline comments above show exact lines and suggested fixes.',
		);
	} else {
		summaryLines.push('No issues detected. Clean diff 🎉');
	}

	if (verdict === 'fail') {
		summaryLines.push(
			'',
			'---',
			'Fix all 🔴 **critical** issues, push a new commit, then comment `/recheck` to re-run.',
		);
	}

	summaryLines.push(
		'',
		`---\n_Powered by regex pattern scan · auto-fix via fs · one-click fix-all_`,
	);

	await githubRequest(
		`https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews`,
		'POST',
		{
			commit_id: commitSha,
			body: summaryLines.join('\n'),
			event: verdict === 'pass' ? 'APPROVE' : 'REQUEST_CHANGES',
			comments: comments.length > 0 ? comments : undefined,
		},
		token,
	);
	console.log(
		`[PR-Service] Review posted — ${verdict === 'pass' ? 'APPROVE' : 'REQUEST_CHANGES'}, ${comments.length} inline comment(s)`,
	);
}

// ─── Stage 5: Auto-label ──────────────────────────────────────────────────────

async function autoLabel(repo, prNumber, issues, verdict, token) {
	const labels = [...new Set(issues.map((i) => i.category))];
	if (verdict === 'fail') labels.push('blocked');
	else if (verdict === 'pass') labels.push('auto-approved');
	else labels.push('needs-review');

	await githubRequest(
		`https://api.github.com/repos/${repo}/issues/${prNumber}/labels`,
		'POST',
		{ labels },
		token,
	);
	console.log(`[PR-Service] Labels applied: ${labels.join(', ')}`);
}

// ─── Stage 6: Set commit status ──────────────────────────────────────────────

async function setCommitStatus(repo, sha, verdict, description, token) {
	const stateMap = {
		pending: 'pending',
		pass: 'success',
		warn: 'success',
		fail: 'failure',
	};

	// GitHub status API rejects 4-byte Unicode (emojis) in description
	const safeDescription = description
		.replace(/[\u{1F000}-\u{1FFFF}]/gu, '') // remove 4-byte emoji blocks
		.replace(/[\u{20000}-\u{10FFFF}]/gu, '') // remove supplementary planes
		.replace(/⏳|✅|❌|⚡|🔄/g, '') // remove common 3-byte emoji too
		.trim()
		.slice(0, 140);

	await githubRequest(
		`https://api.github.com/repos/${repo}/statuses/${sha}`,
		'POST',
		{
			state: stateMap[verdict] ?? 'error',
			description: safeDescription,
			context: 'repo-intel-pr-checker',
		},
		token,
	);
	console.log(
		`[PR-Service] Status → ${stateMap[verdict] ?? 'error'}: ${description}`,
	);
}
// ─── Stage 7: Auto-close or auto-merge ───────────────────────────────────────

async function autoClosePR(repo, prNumber, sha, token) {
	try {
		await githubRequest(
			`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
			'POST',
			{
				body: [
					'## 🚨 Merge Blocked by Automated PR Checker',
					'',
					'One or more **critical** issues were found in this PR.',
					'Please fix all 🔴 critical issues, push a new commit, then comment `/recheck` to re-run the analysis.',
					'',
					'_This PR cannot be merged until all critical issues are resolved._',
				].join('\n'),
			},
			token,
		);
		console.log(`[PR-Service] Block comment posted on PR #${prNumber}`);
	} catch (err) {
		console.warn(`[PR-Service] autoClosePR comment failed: ${err.message}`);
	}
}

async function autoMergePR(repo, prNumber, token) {
	try {
		await githubRequest(
			`https://api.github.com/repos/${repo}/pulls/${prNumber}/merge`,
			'PUT',
			{
				merge_method: 'squash',
				commit_title: `Auto-merged: PR #${prNumber} passed all checks ✅`,
			},
			token,
		);
		console.log(`[PR-Service] PR #${prNumber} auto-merged`);
	} catch (err) {
		console.warn(`[PR-Service] Auto-merge skipped: ${err.message}`);
	}
}

// ─── Idempotency guard ────────────────────────────────────────────────────────

async function idempotencyFunc(sha) {
	const key = `pr:posted:${sha}`;
	const set = await redis.set(key, '1', 'EX', CACHE_TTL_S, 'NX');
	if (!set) {
		console.log(
			`[PR-Service] Idempotency guard: already posted for sha=${sha.slice(0, 7)}, skipping`,
		);
		return false;
	}
	return true;
}

// ─── Core analysis logic ──────────────────────────────────────────────────────

async function runAnalysis({
	pr,
	repo,
	sha,
	prNum,
	token,
	repoRoot,
	isRecheck = false,
}) {
	console.log(
		`\n[PR-Service] ── Analysing PR #${prNum} (${repo}) sha=${sha.slice(0, 7)} ──`,
	);

	// Step 0: Block merge button immediately
	await setCommitStatus(
		repo,
		sha,
		'pending',
		'⏳ Checking PR — do not merge yet…',
		token,
	);

	// Step 1: Rate limit check
	const allowed = await checkRateLimit(repo);
	if (!allowed) {
		await setCommitStatus(
			repo,
			sha,
			'fail',
			'❌ Rate limit reached — try again later',
			token,
		);
		return;
	}

	// Step 1.5: Check Redis cache BEFORE fetching the diff.
	// Issues + findings are already stored in cacheSet — no extra Redis cost.
	// Use idempotency guard to decide how much to replay:
	//   · First time we see this SHA (or after a Redis restart) → post full review
	//   · Already posted before                                 → just restore status
	if (!isRecheck) {
		const quickPatterns = getPatternsForDiff('');
		const cached = await cacheGet(sha, quickPatterns);
		if (cached) {
			const { verdict, summary, issues, findings } = cached;
			console.log(
				`[PR-Service] Cache hit sha=${sha.slice(0, 7)} — verdict=${verdict}, issues=${issues.length}`,
			);

			// Always restore the commit status immediately
			await setCommitStatus(repo, sha, verdict, summary, token);

			// Re-post review + labels only if the idempotency key is gone
			// (i.e. first time we're showing results for this SHA)
			const shouldPost = await idempotencyFunc(sha);
			if (shouldPost && (issues.length > 0 || findings.length > 0)) {
				console.log(
					`[PR-Service] Re-posting cached review for sha=${sha.slice(0, 7)}`,
				);
				await Promise.all([
					postReview(repo, prNum, sha, issues, findings, verdict, token, []),
					autoLabel(repo, prNum, issues, verdict, token),
				]);
				if (verdict === 'fail') await autoClosePR(repo, prNum, sha, token);
			} else {
				console.log(
					`[PR-Service] Review already posted for sha=${sha.slice(0, 7)} — status restored only`,
				);
			}

			return { verdict, issues, findings };
		}
	}

	if (isRecheck) {
		await dismissPreviousReviews(repo, prNum, token);
		await setCommitStatus(repo, sha, 'pending', '🔄 Re-check in progress…', token);
	}

	// Step 2: Fetch + strip diff
	let diff;
	try {
		await setCommitStatus(repo, sha, 'pending', '⏳ Fetching diff…', token);
		const rawDiff = await getDiff(pr.diff_url, token);
		diff = stripNoisyFiles(rawDiff);
		console.log(
			`[PR-Service] Diff: ${rawDiff.length} chars raw → ${diff.length} chars after stripping`,
		);

		if (!diff.trim()) {
			console.log(
				'[PR-Service] Diff is empty after stripping — skipping analysis',
			);
			const verdict = 'pass';
			const summary =
				'✅ No reviewable changes detected (diff contained only generated/lock files)';
			await Promise.all([
				postReview(repo, prNum, sha, [], [], verdict, token),
				autoLabel(repo, prNum, [], verdict, token),
				setCommitStatus(repo, sha, verdict, summary, token),
			]);
			await autoMergePR(repo, prNum, token);
			return { verdict, issues: [] };
		}
	} catch (err) {
		console.error('[PR-Service] Diff fetch failed:', err.message);
		await setCommitStatus(
			repo,
			sha,
			'fail',
			'❌ Could not fetch PR diff',
			token,
		);
		return;
	}

	// Step 3: Resolve live patterns for this diff's language
	const allPatterns = getPatternsForDiff(diff);

	// Step 5: Regex pre-scan (free)
	await setCommitStatus(
		repo,
		sha,
		'pending',
		'⏳ Scanning for issue patterns…',
		token,
	);

	let issues = [];
	const hasSignals = cheapPreScan(diff, allPatterns);

	if (!hasSignals) {
		console.log('[PR-Service] Pre-scan clean → no issues found');
	} else {
		// Step 5b: Keyword pre-filter
		const patterns = filterPatternsByKeyword(diff, allPatterns);

		if (patterns.length === 0) {
			console.log(
				'[PR-Service] All patterns filtered by keyword pre-filter → no issues',
			);
		} else {
			// Direct regex match (Voyage disabled)
			issues = patterns
				.filter((p) => p.regex?.test(diff))
				.map((p) => ({ ...p, score: 1.0 }));
			console.log(`[PR-Service] Regex matched ${issues.length} issue(s)`);
		}
	}

	// Step 6: Map issues to exact diff line positions
	await setCommitStatus(
		repo,
		sha,
		'pending',
		'⏳ Mapping issues to diff lines…',
		token,
	);
	const findings = findDiffPositions(diff, issues);
	console.log(`[PR-Service] Inline comment targets: ${findings.length}`);

	// Step 7: Build verdict
	const verdict =
		issues.some((i) => i.severity === 'critical') ? 'fail'
		: issues.some((i) => i.severity === 'warning') ? 'warn'
		: 'pass';

	const summary =
		issues.length === 0 ? '✅ No issues detected — clean diff'
		: verdict === 'fail' ?
			`❌ ${issues.filter((i) => i.severity === 'critical').length} critical issue(s) found — merge blocked`
		:	`⚠️ ${issues.length} warning(s) found — review before merging`;

	console.log(`[PR-Service] Verdict: ${verdict}`);

	// Step 8: Cache result
	await cacheSet(sha, { issues, findings, verdict, summary });

	// Step 9: Idempotency guard
	const shouldProceed = await idempotencyFunc(sha);
	if (!shouldProceed) return;

	// ── STEP 10: FIX ALL — FIRST, before any GitHub call ─────────────────────
	//
	// applyAllFixes() writes every fix to disk RIGHT NOW.
	// By the time postReview() / autoLabel() / setCommitStatus() fire below,
	// the repo is already patched. The review comment will say "auto-fix applied"
	// and the developer sees a clean file when they open it.
	//
	await setCommitStatus(
		repo,
		sha,
		'pending',
		'⚡ Applying fixes to disk…',
		token,
	);
	const fixResults = await applyAllFixes(
		findings,
		repoRoot ?? DEFAULT_REPO_ROOT,
	);

	// Step 11: Post review, labels, and final status in parallel
	try {
		await Promise.all([
			postReview(
				repo,
				prNum,
				sha,
				issues,
				findings,
				verdict,
				token,
				fixResults,
			),
			autoLabel(repo, prNum, issues, verdict, token),
			setCommitStatus(repo, sha, verdict, summary, token),
		]);

		if (verdict === 'fail') await autoClosePR(repo, prNum, sha, token);
		else if (verdict === 'pass') await autoMergePR(repo, prNum, token);
		if (isRecheck) {
			await githubRequest(
				`https://api.github.com/repos/${repo}/issues/${prNum}/comments`,
				'POST',
				{
					body: [
						'## ✅ Re-check Complete',
						'',
						`**Verdict: ${
							verdict === 'fail' ? '🔴 Blocked — critical issues found'
							: verdict === 'warn' ? '🟡 Warnings — review before merging'
							: '✅ Clean — no issues detected'
						}**`,
						'',
						`| | |`,
						`|---|---|`,
						`| Issues found | ${issues.length} |`,
						`| Critical | ${issues.filter((i) => i.severity === 'critical').length} |`,
						`| Warnings | ${issues.filter((i) => i.severity === 'warning').length} |`,
						'',
						verdict === 'fail' ?
							'> Fix all 🔴 critical issues, push a new commit, then comment `/recheck` again.'
						: verdict === 'warn' ?
							'> Review the warnings above and push a fix if needed.'
						:	'> All checks passed — this PR is ready to merge 🎉',
					].join('\n'),
				},
				token,
			).catch((err) =>
				console.warn(
					`[PR-Service] Could not post recheck-done comment: ${err.message}`,
				),
			);
		}

		console.log(`[PR-Service] ── Done PR #${prNum} — ${verdict} ──\n`);
	} catch (err) {
		console.error('[PR-Service] Failed to post results:', err.message);
	}

	return { verdict, issues, fixResults };
}

// ─── In-process async runner (replaces BullMQ) ───────────────────────────────
// Jobs run directly in the background — no Redis queue needed.
// A simple in-flight set prevents duplicate runs for the same SHA.

const _inFlight = new Set();

async function enqueueAnalysis({ pr, repo, sha, prNum, token, repoRoot, isRecheck }) {
	const jobKey = isRecheck
		? `${repo}__${sha}__recheck_${Date.now()}`
		: `${repo}__${sha}`;

	if (_inFlight.has(jobKey)) {
		console.log(`[PR-Service] Already running job for ${jobKey} — skipping duplicate`);
		return;
	}

	_inFlight.add(jobKey);
	console.log(`[PR-Service] PR #${prNum} starting analysis (key: ${jobKey})`);

	// Fire-and-forget — non-blocking so the webhook 200 returns immediately
	runAnalysis({ pr, repo, sha, prNum, token, repoRoot, isRecheck })
		.catch((err) => console.error(`[PR-Service] Analysis error for ${jobKey}:`, err.message))
		.finally(() => _inFlight.delete(jobKey));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * analyzePR — queues a PR for full analysis + auto-fix.
 *
 * Pass repoRoot so applyAllFixes knows where the checkout lives on disk.
 *
 *   await analyzePR(webhookPayload, { repoRoot: '/workspace/my-repo' });
 */
exports.analyzePR = async (payload, options = {}) => {
	const token = process.env.GITHUB_TOKEN;
	const pr = payload.pull_request;
	const repo = payload.repository.full_name;
	const sha = pr.head.sha;
	const prNum = pr.number;
	const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
	const isRecheck = options.isRecheck ?? false;

	enqueueAnalysis({ pr, repo, sha, prNum, token, repoRoot, isRecheck });
};
/**
 * applyAllFixes — exported for direct use from a REST route or CLI.
 *
 * Applies every buildFix() result from cached findings to files on disk.
 * No AI, no network — pure fs read/write. All files patched in parallel.
 *
 * POST /fix-all
 *   Body : { sha: string, repoRoot: string }
 *   Reply: { results: [{ path, position, original, fixed, applied, error }] }
 *
 * Express example:
 *
 *   const { applyAllFixes } = require('./pr_service');
 *
 *   app.post('/fix-all', async (req, res) => {
 *     const { sha, repoRoot } = req.body;
 *     const cached = await cacheGet(sha, getPatternsForDiff(''));
 *     if (!cached) return res.status(404).json({ error: 'No cached result for SHA' });
 *     const results = await applyAllFixes(cached.findings, repoRoot);
 *     res.json({ results });
 *   });
 */
exports.applyAllFixes = applyAllFixes;

// ─── Webhook handler ──────────────────────────────────────────────────────────

// ─── Webhook handler ──────────────────────────────────────────────────────────

async function cacheDelete(sha) {
	await redis.del(`pr:result:${sha}`);
	await redis.del(`pr:posted:${sha}`);
	console.log(`[PR-Service] Cache cleared for sha=${sha.slice(0, 7)}`);
}

// Bot comments that should never trigger commands — prevents feedback loops.
// IMPORTANT: entries must match the EXACT first line each bot comment posts
// (including any leading emoji) so startsWith() catches them reliably.
const BOT_COMMENT_PREFIXES = [
	'## Re-check Started',
	'## Re-check Queued',
	'## Re-check Failed',
	'## Re-check Complete',
	'## Fix-All Started',
	'## Fix-All Complete',
	'## Fix-All Failed',
	'## 🚨 Merge Blocked',   // autoClosePR posts this exact heading
	'## Merge Blocked',          // fallback without emoji
	'## ✅ Re-check Complete',    // alternate emoji variant
];

// Commands must appear on their own line (not embedded in prose).
// e.g.  "then comment `/recheck` again"  must NOT trigger a recheck.
const CMD_RECHECK = /(?:^|\n)\s*\/recheck\s*(?:\n|$)/;
const CMD_FIX_ALL = /(?:^|\n)\s*\/fix-all\s*(?:\n|$)/;

exports.handleWebhook = async (event, payload) => {
	console.log(`[PR-Service] Webhook: event=${event} action=${payload.action}`);

	// ── pull_request events ───────────────────────────────────────────────────
	if (event === 'pull_request') {
		if (['opened', 'synchronize', 'reopened'].includes(payload.action)) {
			// For synchronize events, fetch the actual commit message from GitHub
			// to detect bot-authored commits. The PR webhook payload does NOT
			// include head.commit.message — only head.sha is available.
			if (payload.action === 'synchronize') {
				const sha = payload.pull_request?.head?.sha;
				const repo = payload.repository?.full_name;
				const token = process.env.GITHUB_TOKEN;
				try {
					const commit = await githubRequest(
						`https://api.github.com/repos/${repo}/git/commits/${sha}`,
						'GET',
						undefined,
						token,
					);
					if ((commit?.message ?? '').includes('[pr-checker]')) {
						console.log(
							`[PR-Service] Ignoring synchronize for ${sha?.slice(0, 7)} — bot commit`,
						);
						return;
					}
				} catch (err) {
					console.warn(
						`[PR-Service] Could not verify commit message for ${sha?.slice(0, 7)}: ${err.message}`,
					);
					// Proceed with analysis if we can't verify — better to re-analyse
					// than to silently drop a legitimate push.
				}
			}

			return exports.analyzePR(payload);
		}
		return;
	}

	// ── issue_comment events ──────────────────────────────────────────────────
	if (event === 'issue_comment' && payload.action === 'created') {
		const body = payload.comment?.body?.trim() ?? '';
		const prNumber = payload.issue?.number;
		const repo = payload.repository?.full_name;
		const token = process.env.GITHUB_TOKEN;
		const isPR = !!payload.issue?.pull_request;

		console.log(
			`[PR-Service] Comment body: "${body.slice(0, 80)}" | isPR: ${isPR}`,
		);

		// Guard 1: must be on a PR, not a plain issue
		if (!isPR) {
			console.log('[PR-Service] Comment is on an issue, not a PR — ignoring');
			return;
		}

		// Guard 2: ignore our own bot comments to prevent feedback loops
		if (BOT_COMMENT_PREFIXES.some((prefix) => body.startsWith(prefix))) {
			console.log('[PR-Service] Ignoring bot-generated comment — skipping');
			return;
		}

		// Guard 3: command must be on its own line — not embedded in prose.
		// "then comment `/recheck` again" must NOT trigger a recheck.
		const hasRecheck = CMD_RECHECK.test(body);
		const hasFixAll  = CMD_FIX_ALL.test(body);

		if (!hasRecheck && !hasFixAll) {
			console.log('[PR-Service] Comment did not match any command — ignoring');
			return;
		}

		// ── /recheck ─────────────────────────────────────────────────────────────
		if (hasRecheck) {
			console.log(`[PR-Service] /recheck triggered on PR #${prNumber}`);

			await githubRequest(
				`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
				'POST',
				{
					body: [
						'## Re-check Started',
						'',
						'> Clearing cache and re-running full analysis on the latest commit...',
					].join('\n'),
				},
				token,
			).catch((err) =>
				console.warn(
					`[PR-Service] Could not post recheck-start comment: ${err.message}`,
				),
			);

			const res = await fetch(payload.issue.pull_request.url, {
				headers: GITHUB_HEADERS(token),
			});

			if (!res.ok) {
				await githubRequest(
					`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
					'POST',
					{
						body: `## Re-check Failed\n\nCould not fetch PR data (HTTP ${res.status}).`,
					},
					token,
				).catch(() => {});
				return;
			}

			const pr = await res.json();
			await cacheDelete(pr.head.sha);

			try {
				await exports.analyzePR(
					{ pull_request: pr, repository: payload.repository },
					{ isRecheck: true },
				);

				await githubRequest(
					`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
					'POST',
					{
						body: [
							'## Re-check Queued',
							'',
							'> Analysis is running — review comment will appear shortly.',
						].join('\n'),
					},
					token,
				).catch((err) =>
					console.warn(
						`[PR-Service] Could not post recheck-queued comment: ${err.message}`,
					),
				);
			} catch (err) {
				console.error(`[PR-Service] /recheck failed: ${err.message}`);
				await githubRequest(
					`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
					'POST',
					{ body: `## Re-check Failed\n\n\`${err.message}\`` },
					token,
				).catch(() => {});
			}

			return;
		}

		// ── /fix-all ─────────────────────────────────────────────────────────────
		if (hasFixAll) {
			console.log(`[PR-Service] /fix-all triggered on PR #${prNumber}`);

			await githubRequest(
				`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
				'POST',
				{
					body: [
						'## Fix-All Started',
						'',
						'> Fetching PR data and applying all auto-fixes via GitHub API...',
					].join('\n'),
				},
				token,
			).catch((err) =>
				console.warn(
					`[PR-Service] Could not post fix-all-start comment: ${err.message}`,
				),
			);

			const res = await fetch(payload.issue.pull_request.url, {
				headers: GITHUB_HEADERS(token),
			});

			if (!res.ok) {
				await githubRequest(
					`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
					'POST',
					{
						body: `## Fix-All Failed\n\nCould not fetch PR data (HTTP ${res.status}).`,
					},
					token,
				).catch(() => {});
				return;
			}

			const pr = await res.json();
			const sha = pr.head.sha;
			const branch = pr.head.ref;

			console.log(
				`[PR-Service] /fix-all — sha=${sha.slice(0, 7)} branch=${branch}`,
			);

			const cached = await cacheGet(sha, getPatternsForDiff(''));

			if (!cached || !cached.findings?.length) {
				await githubRequest(
					`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
					'POST',
					{
						body: [
							'## Fix-All Failed',
							'',
							'No cached analysis found for the latest commit.',
							'Please comment `/recheck` first to generate findings, then `/fix-all`.',
						].join('\n'),
					},
					token,
				).catch(() => {});
				return;
			}

			console.log(
				`[PR-Service] /fix-all — ${cached.findings.length} finding(s) — Ollama + buildFix`,
			);

			try {
				// Step A: Pre-fetch all unique files to extract surrounding context for Ollama.
				// Ollama with context = project-aware fix; without = generic template.
				const fileCache = new Map(); // filePath → { lines[], sha }
				const uniquePaths = [...new Set(cached.findings.map((f) => f.path))];

				await Promise.all(
					uniquePaths.map(async (filePath) => {
						try {
							const fd  = await githubRequest(
								`https://api.github.com/repos/${repo}/contents/${filePath}` +
									(branch ? `?ref=${branch}` : ''),
								'GET', undefined, token,
							);
							fileCache.set(filePath, {
								lines: Buffer.from(fd.content, 'base64').toString('utf8').split('\n'),
								sha  : fd.sha,
							});
						} catch { /* file fetch failed — Ollama will run without context */ }
					}),
				);

				// Enrich each finding with surrounding code lines (5 above + 5 below).
				// The bad line is marked with >>> so Ollama knows exactly what to fix.
				const enrichedFindings = cached.findings.map((f) => {
					const fc = fileCache.get(f.path);
					if (!fc) return f;
					const lineIdx = fc.lines.findIndex((l) => l.trim() === f.lineContent.trim());
					if (lineIdx === -1) return f;
					const start   = Math.max(0, lineIdx - 5);
					const end     = Math.min(fc.lines.length - 1, lineIdx + 5);
					const ctx     = fc.lines.slice(start, end + 1).map((l, i) =>
						(start + i) === lineIdx ? `>>> ${l.trimStart()}` : `    ${l.trimStart()}`,
					).join('\n');
					return { ...f, surroundingContext: ctx };
				});

				// Step B: Generate fixes — Ollama (with context) first, buildFix() fallback
				const fixSuggestions = await fixFindings(enrichedFindings);

				const ollamaCount   = fixSuggestions.filter((r) => r.source === 'ollama').length;
				const buildFixCount = fixSuggestions.filter((r) => r.source === 'buildFix').length;
				const noneCount     = fixSuggestions.filter((r) => r.source === 'none').length;

				// Step B: Only commit findings that have a fix
				const fixable = cached.findings.filter((f, i) => fixSuggestions[i]?.fixed);
				const fixableWithOverride = fixable.map((f, i) => ({
					...f,
					// Override buildFix to return the Ollama/pattern fix we already computed
					issue: {
						...f.issue,
						buildFix: () => fixSuggestions[
							cached.findings.indexOf(f)
						]?.fixed ?? f.issue.buildFix(f.lineContent),
					},
				}));

				// Step C: Commit via GitHub API
				const commitResults = fixable.length > 0
					? await applyAllFixes(fixableWithOverride, DEFAULT_REPO_ROOT, { repo, token, branch })
					: [];

				const committed = commitResults.filter((r) => r.applied).length;
				const commitFailed = commitResults.filter((r) => !r.applied).length;

				console.log(
					`[PR-Service] /fix-all complete — ollama:${ollamaCount} buildFix:${buildFixCount} none:${noneCount} committed:${committed}`,
				);

				await githubRequest(
					`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
					'POST',
					{
						body: [
							'## Fix-All Complete',
							'',
							`| Engine | Fixes |`,
							`|--------|-------|`,
							`| 🤖 Ollama AI | ${ollamaCount} |`,
							`| 🔧 Pattern (buildFix) | ${buildFixCount} |`,
							`| ⚠️ No fix available | ${noneCount} |`,
							`| ✅ Committed to branch | ${committed} |`,
							`| ❌ Commit failed | ${commitFailed} |`,
							'',
							committed > 0
								? `Fixes pushed to \`${branch}\`. Comment \`/recheck\` to verify.`
								: 'No fixes could be committed — files may already be clean.',
						].join('\n'),
					},
					token,
				).catch(() => {});
			} catch (err) {
				console.error(`[PR-Service] /fix-all error: ${err.message}`);
				await githubRequest(
					`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
					'POST',
					{ body: `## Fix-All Failed\n\n\`${err.message}\`` },
					token,
				).catch(() => {});
			}

			return;
		}
	}
};
/**
 * cacheGet — exported so scripts/run-fix-all.js can load findings by SHA
 * without duplicating the Redis + re-hydration logic.
 */
exports.cacheGet = cacheGet;

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown() {
	console.log('[PR-Service] Shutting down…');
	try { await redis.quit(); } catch (_) {}
	process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
