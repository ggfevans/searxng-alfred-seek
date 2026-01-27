# Bang Modifiers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bang modifiers (`!i`, `!news`, `!d`, `!w`, etc.) for category and time filtering in search queries.

**Architecture:** Pure `parseBangs()` function extracts bangs from query, returns parsed object with clean query + detected category/timeRange. The `search()` function uses this to build the SearXNG API URL with optional `categories` and `time_range` parameters.

**Tech Stack:** JXA (JavaScript for Automation), Node.js test runner for unit tests.

**Design Doc:** `docs/plans/2026-01-27-bang-modifiers-design.md`

---

## Task 1: Add parseBangs() Tests

**Files:**
- Create: `tests/parse-bangs.test.js`

**Step 1: Create test file with basic test cases**

```javascript
#!/usr/bin/env node
/**
 * Unit tests for parseBangs function
 * Run with: node --test tests/parse-bangs.test.js
 */

const assert = require("node:assert");
const { describe, it } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

// Extract parseBangs function from search.js
function loadParseBangs() {
	const searchJs = fs.readFileSync(
		path.join(__dirname, "../scripts/search.js"),
		"utf-8"
	);
	const match = searchJs.match(
		/function parseBangs\(query\) \{[\s\S]*?\n\}/
	);
	if (!match) {
		throw new Error("Could not find parseBangs function in search.js");
	}
	// eslint-disable-next-line no-eval
	return eval(`(${match[0]})`);
}

const parseBangs = loadParseBangs();

describe("parseBangs", () => {
	describe("category bangs", () => {
		it("extracts !i as images category", () => {
			const result = parseBangs("!i cats");
			assert.strictEqual(result.query, "cats");
			assert.strictEqual(result.category, "images");
			assert.strictEqual(result.timeRange, null);
		});

		it("extracts !images as images category", () => {
			const result = parseBangs("!images cats");
			assert.strictEqual(result.query, "cats");
			assert.strictEqual(result.category, "images");
		});

		it("extracts !n as news category", () => {
			const result = parseBangs("!n climate");
			assert.strictEqual(result.query, "climate");
			assert.strictEqual(result.category, "news");
		});

		it("extracts !news as news category", () => {
			const result = parseBangs("!news climate");
			assert.strictEqual(result.query, "climate");
			assert.strictEqual(result.category, "news");
		});

		it("extracts !v as videos category", () => {
			const result = parseBangs("!v tutorials");
			assert.strictEqual(result.query, "tutorials");
			assert.strictEqual(result.category, "videos");
		});

		it("extracts !videos as videos category", () => {
			const result = parseBangs("!videos tutorials");
			assert.strictEqual(result.query, "tutorials");
			assert.strictEqual(result.category, "videos");
		});

		it("extracts !maps as maps category (no short form)", () => {
			const result = parseBangs("!maps coffee");
			assert.strictEqual(result.query, "coffee");
			assert.strictEqual(result.category, "maps");
		});
	});

	describe("time range bangs", () => {
		it("extracts !d as day time range", () => {
			const result = parseBangs("!d news");
			assert.strictEqual(result.query, "news");
			assert.strictEqual(result.timeRange, "day");
			assert.strictEqual(result.category, null);
		});

		it("extracts !w as week time range", () => {
			const result = parseBangs("!w news");
			assert.strictEqual(result.query, "news");
			assert.strictEqual(result.timeRange, "week");
		});

		it("extracts !m as month time range", () => {
			const result = parseBangs("!m news");
			assert.strictEqual(result.query, "news");
			assert.strictEqual(result.timeRange, "month");
		});

		it("extracts !y as year time range", () => {
			const result = parseBangs("!y news");
			assert.strictEqual(result.query, "news");
			assert.strictEqual(result.timeRange, "year");
		});
	});

	describe("combined bangs", () => {
		it("extracts both category and time range", () => {
			const result = parseBangs("!n !w climate");
			assert.strictEqual(result.query, "climate");
			assert.strictEqual(result.category, "news");
			assert.strictEqual(result.timeRange, "week");
		});

		it("works with bangs at end of query", () => {
			const result = parseBangs("climate !n !w");
			assert.strictEqual(result.query, "climate");
			assert.strictEqual(result.category, "news");
			assert.strictEqual(result.timeRange, "week");
		});

		it("works with bangs in middle of query", () => {
			const result = parseBangs("climate !n change !w");
			assert.strictEqual(result.query, "climate change");
			assert.strictEqual(result.category, "news");
			assert.strictEqual(result.timeRange, "week");
		});

		it("handles !maps and !m together (maps + month)", () => {
			const result = parseBangs("!maps !m coffee");
			assert.strictEqual(result.query, "coffee");
			assert.strictEqual(result.category, "maps");
			assert.strictEqual(result.timeRange, "month");
		});
	});

	describe("case insensitivity", () => {
		it("handles uppercase bangs", () => {
			const result = parseBangs("!I cats");
			assert.strictEqual(result.query, "cats");
			assert.strictEqual(result.category, "images");
		});

		it("handles mixed case bangs", () => {
			const result = parseBangs("!Images cats");
			assert.strictEqual(result.query, "cats");
			assert.strictEqual(result.category, "images");
		});
	});

	describe("unknown bangs", () => {
		it("leaves unknown bangs in query", () => {
			const result = parseBangs("!foo bar");
			assert.strictEqual(result.query, "!foo bar");
			assert.strictEqual(result.category, null);
			assert.strictEqual(result.timeRange, null);
		});

		it("leaves unknown bangs but extracts known ones", () => {
			const result = parseBangs("!foo !i bar");
			assert.strictEqual(result.query, "!foo bar");
			assert.strictEqual(result.category, "images");
		});
	});

	describe("edge cases", () => {
		it("handles query with no bangs", () => {
			const result = parseBangs("just a normal query");
			assert.strictEqual(result.query, "just a normal query");
			assert.strictEqual(result.category, null);
			assert.strictEqual(result.timeRange, null);
		});

		it("handles empty query", () => {
			const result = parseBangs("");
			assert.strictEqual(result.query, "");
			assert.strictEqual(result.category, null);
			assert.strictEqual(result.timeRange, null);
		});

		it("handles only bangs (empty result query)", () => {
			const result = parseBangs("!i !w");
			assert.strictEqual(result.query, "");
			assert.strictEqual(result.category, "images");
			assert.strictEqual(result.timeRange, "week");
		});

		it("last category bang wins when duplicates", () => {
			const result = parseBangs("!i !n cats");
			assert.strictEqual(result.category, "news");
		});

		it("does not match bang in middle of word", () => {
			const result = parseBangs("exciting cats");
			assert.strictEqual(result.query, "exciting cats");
			assert.strictEqual(result.category, null);
		});
	});
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/parse-bangs.test.js`
Expected: FAIL with "Could not find parseBangs function"

**Step 3: Commit test file**

```bash
git add tests/parse-bangs.test.js
git commit -m "test: add parseBangs unit tests"
```

---

## Task 2: Implement parseBangs() Function

**Files:**
- Modify: `scripts/search.js` (add after line 112, after `shellEscape`)

**Step 1: Add parseBangs function to search.js**

Add this after the `shellEscape` function (around line 112):

```javascript
/**
 * Parse bang modifiers from query string.
 * Extracts category bangs (!i, !images, !n, !news, !v, !videos, !maps)
 * and time range bangs (!d, !w, !m, !y) from anywhere in the query.
 * @param {string} query - Raw query string with potential bangs
 * @returns {{query: string, category: string|null, timeRange: string|null}}
 */
function parseBangs(query) {
	const categoryBangs = {
		"!images": "images",
		"!i": "images",
		"!news": "news",
		"!n": "news",
		"!videos": "videos",
		"!v": "videos",
		"!maps": "maps",
	};

	const timeRangeBangs = {
		"!d": "day",
		"!w": "week",
		"!m": "month",
		"!y": "year",
	};

	let category = null;
	let timeRange = null;
	let cleanQuery = query;

	// Extract category bangs (case-insensitive, word boundary)
	for (const [bang, value] of Object.entries(categoryBangs)) {
		const regex = new RegExp(`(^|\\s)${bang}(?=\\s|$)`, "gi");
		if (regex.test(cleanQuery)) {
			category = value;
			cleanQuery = cleanQuery.replace(regex, "$1");
		}
	}

	// Extract time range bangs (case-insensitive, word boundary)
	for (const [bang, value] of Object.entries(timeRangeBangs)) {
		const regex = new RegExp(`(^|\\s)${bang}(?=\\s|$)`, "gi");
		if (regex.test(cleanQuery)) {
			timeRange = value;
			cleanQuery = cleanQuery.replace(regex, "$1");
		}
	}

	// Clean up extra whitespace
	cleanQuery = cleanQuery.replace(/\s+/g, " ").trim();

	return {
		query: cleanQuery,
		category,
		timeRange,
	};
}
```

**Step 2: Run tests to verify they pass**

Run: `node --test tests/parse-bangs.test.js`
Expected: All tests PASS

**Step 3: Run all tests to ensure no regressions**

Run: `npm test`
Expected: All tests PASS

**Step 4: Commit implementation**

```bash
git add scripts/search.js
git commit -m "feat: add parseBangs function for bang modifiers"
```

---

## Task 3: Integrate parseBangs into search()

**Files:**
- Modify: `scripts/search.js` (update `search` function around line 447)

**Step 1: Update search function to use parseBangs**

Replace the query trimming and URL construction section (around lines 481-483):

```javascript
// OLD CODE (remove):
query = query.trim();
const searchUrl = `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json`;

// NEW CODE (replace with):
// Parse bangs from query
const parsed = parseBangs(query.trim());
const cleanQuery = parsed.query;

// Guard: Empty query after bang extraction
if (!cleanQuery) {
	return {
		items: [
			{
				title: "Search SearXNG...",
				subtitle: formatFilterSubtitle(parsed.category, parsed.timeRange) || "Type a query to search",
				valid: false,
			},
		],
	};
}

// Build search URL with optional category and time_range
let searchUrl = `${searxngUrl}/search?q=${encodeURIComponent(cleanQuery)}&format=json`;
if (parsed.category) {
	searchUrl += `&categories=${encodeURIComponent(parsed.category)}`;
}
if (parsed.timeRange) {
	searchUrl += `&time_range=${encodeURIComponent(parsed.timeRange)}`;
}
```

**Step 2: Add formatFilterSubtitle helper function**

Add before the `search` function (around line 437):

```javascript
/**
 * Format active filters for display in subtitle.
 * @param {string|null} category - Active category filter
 * @param {string|null} timeRange - Active time range filter
 * @returns {string} Formatted filter string or empty string
 */
function formatFilterSubtitle(category, timeRange) {
	const parts = [];
	if (category) {
		parts.push(category.charAt(0).toUpperCase() + category.slice(1));
	}
	if (timeRange) {
		const timeLabels = { day: "Past day", week: "Past week", month: "Past month", year: "Past year" };
		parts.push(timeLabels[timeRange] || timeRange);
	}
	return parts.join(" · ");
}
```

**Step 3: Update resultToAlfredItem to pass cleanQuery**

Update the `resultToAlfredItem` calls (around line 570-572):

```javascript
// OLD CODE:
const items = data.results.map((result) =>
	resultToAlfredItem(result, query, searxngUrl, secretKey)
);

// NEW CODE:
const items = data.results.map((result) =>
	resultToAlfredItem(result, cleanQuery, searxngUrl, secretKey, parsed.category, parsed.timeRange)
);
```

**Step 4: Update resultToAlfredItem signature and subtitle**

Update the function signature and subtitle (around line 409):

```javascript
/**
 * Transform a SearXNG result into an Alfred item.
 * @param {object} result - SearXNG result object
 * @param {string} query - Clean search query (bangs removed)
 * @param {string} searxngUrl - SearXNG base URL
 * @param {string} secretKey - SearXNG server secret key (for favicons)
 * @param {string|null} category - Active category filter
 * @param {string|null} timeRange - Active time range filter
 * @returns {object} Alfred item
 */
function resultToAlfredItem(result, query, searxngUrl, secretKey, category = null, timeRange = null) {
	const domain = extractDomain(result.url);
	const snippet = truncate(result.content || "", 80);

	// Build subtitle with optional filter indicator
	const filterInfo = formatFilterSubtitle(category, timeRange);
	const subtitleParts = [domain];
	if (filterInfo) {
		subtitleParts.push(filterInfo);
	}
	if (snippet) {
		subtitleParts.push(snippet);
	}
	const subtitle = subtitleParts.join(" · ");

	// ... rest of function unchanged
```

**Step 5: Update fallbackItem to include filters**

Update fallbackItem function (around line 391):

```javascript
/**
 * Create the fallback "search in browser" item.
 * @param {string} query - Search query
 * @param {string} searxngUrl - SearXNG base URL
 * @param {string|null} category - Active category filter
 * @param {string|null} timeRange - Active time range filter
 * @returns {object} Alfred item
 */
function fallbackItem(query, searxngUrl, category = null, timeRange = null) {
	let searchUrl = `${searxngUrl}/search?q=${encodeURIComponent(query)}`;
	if (category) {
		searchUrl += `&categories=${encodeURIComponent(category)}`;
	}
	if (timeRange) {
		searchUrl += `&time_range=${encodeURIComponent(timeRange)}`;
	}

	const filterInfo = formatFilterSubtitle(category, timeRange);
	const subtitle = filterInfo
		? `Open SearXNG web interface (${filterInfo})`
		: "Open SearXNG web interface";

	return {
		title: `Search "${query}" in browser`,
		subtitle: subtitle,
		arg: searchUrl,
		icon: { path: "icon.png" },
	};
}
```

**Step 6: Update fallbackItem calls to pass filters**

Update all calls to `fallbackItem` in the search function to include parsed values:

```javascript
fallbackItem(cleanQuery, searxngUrl, parsed.category, parsed.timeRange)
```

**Step 7: Run all tests**

Run: `npm test`
Expected: All tests PASS

**Step 8: Manual test**

Test in Alfred:
- `sx cats` → general search
- `sx !i cats` → image search (check API URL has `&categories=images`)
- `sx !n !w climate` → news from past week

**Step 9: Commit integration**

```bash
git add scripts/search.js
git commit -m "feat: integrate bang modifiers into search function

- Parse !i/!images, !n/!news, !v/!videos, !maps for categories
- Parse !d, !w, !m, !y for time ranges
- Update subtitles to show active filters
- Update fallback item to preserve filters"
```

---

## Task 4: Update GitHub Issues

**Step 1: Close issue #6 as superseded**

```bash
gh issue close 6 --comment "Superseded by bang modifiers design. See docs/plans/2026-01-27-bang-modifiers-design.md

Instead of separate keywords (sxi, sxn, sxv), use inline bangs:
- \`sx !i cats\` for images
- \`sx !n cats\` for news
- \`sx !v cats\` for videos
- \`sx !maps cats\` for maps"
```

**Step 2: Close issue #7 as implemented**

```bash
gh issue close 7 --comment "Implemented as part of bang modifiers. See docs/plans/2026-01-27-bang-modifiers-design.md

Time range bangs:
- \`!d\` - past day
- \`!w\` - past week
- \`!m\` - past month
- \`!y\` - past year

Example: \`sx !n !w climate\` searches news from past week."
```

**Step 3: Close issue #12 as won't-do**

```bash
gh issue close 12 --reason "not planned" --comment "Closing as won't-do after design review. See docs/plans/2026-01-27-bang-modifiers-design.md

The bang modifiers design provides flexibility through inline modifiers rather than configurable keywords. The single \`sx\` keyword plus bangs (\`!i\`, \`!n\`, \`!d\`, etc.) covers all use cases without the complexity of user-configurable keywords."
```

---

## Summary

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add parseBangs tests | `test: add parseBangs unit tests` |
| 2 | Implement parseBangs | `feat: add parseBangs function for bang modifiers` |
| 3 | Integrate into search | `feat: integrate bang modifiers into search function` |
| 4 | Close GitHub issues | (no commit, just issue management) |

**Total: ~4 commits, ~150 lines of new code, ~120 lines of tests**
