#!/usr/bin/env node
/**
 * Unit tests for autocomplete functions
 * Run with: node tests/autocomplete.test.js
 */

const assert = require("node:assert");
const { describe, it } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

// Extract parseAutocompleteResponse function from search.js via regex
const searchJs = fs.readFileSync(
	path.join(__dirname, "../scripts/search.js"),
	"utf-8"
);
const parseAutocompleteFn = searchJs.match(
	/function parseAutocompleteResponse\(responseData\) \{[\s\S]*?\n\}/
);
if (!parseAutocompleteFn) {
	throw new Error("Could not find parseAutocompleteResponse function in search.js");
}
// eslint-disable-next-line no-eval
const parseAutocompleteResponse = eval(`(${parseAutocompleteFn[0]})`);

describe("parseAutocompleteResponse", () => {
	describe("valid responses", () => {
		it("parses standard autocomplete response", () => {
			const data = '["clim", ["climate change", "climbing gear", "climate science"]]';
			const result = parseAutocompleteResponse(data);
			assert.deepStrictEqual(result, ["climate change", "climbing gear", "climate science"]);
		});

		it("returns empty array for empty suggestions", () => {
			const data = '["query", []]';
			const result = parseAutocompleteResponse(data);
			assert.deepStrictEqual(result, []);
		});

		it("handles single suggestion", () => {
			const data = '["test", ["testing"]]';
			const result = parseAutocompleteResponse(data);
			assert.deepStrictEqual(result, ["testing"]);
		});
	});

	describe("invalid responses", () => {
		it("returns empty array for invalid JSON", () => {
			const result = parseAutocompleteResponse("not json");
			assert.deepStrictEqual(result, []);
		});

		it("returns empty array for null", () => {
			const result = parseAutocompleteResponse(null);
			assert.deepStrictEqual(result, []);
		});

		it("returns empty array for empty string", () => {
			const result = parseAutocompleteResponse("");
			assert.deepStrictEqual(result, []);
		});

		it("returns empty array for malformed array", () => {
			const result = parseAutocompleteResponse('["only one element"]');
			assert.deepStrictEqual(result, []);
		});

		it("returns empty array for non-array suggestions", () => {
			const result = parseAutocompleteResponse('["query", "not an array"]');
			assert.deepStrictEqual(result, []);
		});
	});
});

// Extract suggestionToAlfredItem function
const suggestionFn = searchJs.match(
	/function suggestionToAlfredItem\(suggestion, searxngUrl, category, timeRange\) \{[\s\S]*?\n\}/
);
if (!suggestionFn) {
	throw new Error("Could not find suggestionToAlfredItem function in search.js");
}
// eslint-disable-next-line no-eval
const suggestionToAlfredItem = eval(`(${suggestionFn[0]})`);

const MOCK_SEARXNG_URL = "https://search.example.com";

describe("suggestionToAlfredItem", () => {
	it("creates basic suggestion item with search URL", () => {
		const item = suggestionToAlfredItem("climate change", MOCK_SEARXNG_URL, null, null);
		assert.strictEqual(item.title, "climate change");
		assert.strictEqual(item.subtitle, "Search for this suggestion");
		assert.strictEqual(item.arg, "https://search.example.com/search?q=climate%20change");
		assert.strictEqual(item.autocomplete, "climate change");
		assert.strictEqual(item.valid, true);
		assert.deepStrictEqual(item.icon, { path: "icon.png" });
	});

	it("inherits category in subtitle and URL", () => {
		const item = suggestionToAlfredItem("mountains", MOCK_SEARXNG_URL, "images", null);
		assert.strictEqual(item.subtitle, "Search images for this suggestion");
		assert.strictEqual(item.arg, "https://search.example.com/search?q=mountains&categories=images");
	});

	it("inherits time range in subtitle and URL", () => {
		const item = suggestionToAlfredItem("news", MOCK_SEARXNG_URL, null, "day");
		assert.strictEqual(item.subtitle, "Search (past day) for this suggestion");
		assert.strictEqual(item.arg, "https://search.example.com/search?q=news&time_range=day");
	});

	it("inherits both category and time range", () => {
		const item = suggestionToAlfredItem("events", MOCK_SEARXNG_URL, "news", "month");
		assert.strictEqual(item.subtitle, "Search news (past month) for this suggestion");
		assert.strictEqual(item.arg, "https://search.example.com/search?q=events&categories=news&time_range=month");
	});

	it("includes variables for bang context", () => {
		const item = suggestionToAlfredItem("test", MOCK_SEARXNG_URL, "images", "month");
		assert.deepStrictEqual(item.variables, {
			category: "images",
			timeRange: "month"
		});
	});

	it("omits variables when no bang context", () => {
		const item = suggestionToAlfredItem("test", MOCK_SEARXNG_URL, null, null);
		assert.strictEqual(item.variables, undefined);
	});
});

// Extract shouldShowFullResults function
const thresholdFn = searchJs.match(
	/function shouldShowFullResults\(query\) \{[\s\S]*?\n\}/
);
if (!thresholdFn) {
	throw new Error("Could not find shouldShowFullResults function in search.js");
}
// eslint-disable-next-line no-eval
const shouldShowFullResults = eval(`(${thresholdFn[0]})`);

// Extract formatFilterSubtitle function (dependency of exactQueryItem)
const formatFilterFn = searchJs.match(
	/function formatFilterSubtitle\(category, timeRange\) \{[\s\S]*?\n\}/
);
if (!formatFilterFn) {
	throw new Error("Could not find formatFilterSubtitle function in search.js");
}
// eslint-disable-next-line no-eval
const formatFilterSubtitle = eval(`(${formatFilterFn[0]})`);

// Extract exactQueryItem function
const exactQueryFn = searchJs.match(
	/function exactQueryItem\(query, searxngUrl, category, timeRange\) \{[\s\S]*?\n\}/
);
if (!exactQueryFn) {
	throw new Error("Could not find exactQueryItem function in search.js");
}
// eslint-disable-next-line no-eval
const exactQueryItem = eval(`(${exactQueryFn[0]})`);

describe("exactQueryItem", () => {
	it("creates item with exact query in title", () => {
		const item = exactQueryItem("test query", MOCK_SEARXNG_URL, null, null);
		assert.strictEqual(item.title, 'Search for "test query"');
	});

	it("includes search URL as arg", () => {
		const item = exactQueryItem("my search", MOCK_SEARXNG_URL, null, null);
		assert.strictEqual(item.arg, "https://search.example.com/search?q=my%20search");
	});

	it("includes category in URL when present", () => {
		const item = exactQueryItem("cats", MOCK_SEARXNG_URL, "images", null);
		assert.strictEqual(item.arg, "https://search.example.com/search?q=cats&categories=images");
	});

	it("includes time range in URL when present", () => {
		const item = exactQueryItem("news", MOCK_SEARXNG_URL, null, "day");
		assert.strictEqual(item.arg, "https://search.example.com/search?q=news&time_range=day");
	});

	it("includes both category and time range in URL", () => {
		const item = exactQueryItem("events", MOCK_SEARXNG_URL, "news", "year");
		assert.strictEqual(item.arg, "https://search.example.com/search?q=events&categories=news&time_range=year");
	});

	it("shows filter info in subtitle when filters active", () => {
		const item = exactQueryItem("test", MOCK_SEARXNG_URL, "images", "month");
		assert.strictEqual(item.subtitle, "Images · Past month");
	});

	it("shows default subtitle when no filters", () => {
		const item = exactQueryItem("test", MOCK_SEARXNG_URL, null, null);
		assert.strictEqual(item.subtitle, "Search SearXNG");
	});

	it("uses workflow icon", () => {
		const item = exactQueryItem("test", MOCK_SEARXNG_URL, null, null);
		assert.deepStrictEqual(item.icon, { path: "icon.png" });
	});

	it("is valid (can be actioned)", () => {
		const item = exactQueryItem("test", MOCK_SEARXNG_URL, null, null);
		assert.strictEqual(item.valid, true);
	});

	it("does not set autocomplete (prevents loop)", () => {
		const item = exactQueryItem("test", MOCK_SEARXNG_URL, null, null);
		assert.strictEqual(item.autocomplete, undefined);
	});
});

// Extract shouldShowExactQueryItem function
const shouldShowExactFn = searchJs.match(
	/function shouldShowExactQueryItem\(query, suggestions\) \{[\s\S]*?\n\}/
);
if (!shouldShowExactFn) {
	throw new Error("Could not find shouldShowExactQueryItem function in search.js");
}
// eslint-disable-next-line no-eval
const shouldShowExactQueryItem = eval(`(${shouldShowExactFn[0]})`);

describe("shouldShowExactQueryItem", () => {
	it("returns true when suggestions exist and first differs from query", () => {
		const result = shouldShowExactQueryItem("test", ["testing", "tester"]);
		assert.strictEqual(result, true);
	});

	it("returns false when first suggestion matches query exactly", () => {
		const result = shouldShowExactQueryItem("test", ["test", "testing"]);
		assert.strictEqual(result, false);
	});

	it("returns false when first suggestion matches query case-insensitively", () => {
		const result = shouldShowExactQueryItem("Test", ["test", "testing"]);
		assert.strictEqual(result, false);
	});

	it("returns false when no suggestions", () => {
		const result = shouldShowExactQueryItem("test", []);
		assert.strictEqual(result, false);
	});

	it("returns false for empty query", () => {
		const result = shouldShowExactQueryItem("", ["test"]);
		assert.strictEqual(result, false);
	});

	it("handles whitespace in query", () => {
		const result = shouldShowExactQueryItem("my query", ["my query", "my queries"]);
		assert.strictEqual(result, false);
	});

	it("handles whitespace differences", () => {
		const result = shouldShowExactQueryItem("my  query", ["my query"]);
		assert.strictEqual(result, true);
	});
});

describe("shouldShowFullResults", () => {
	describe("short queries (≤3 chars) - autocomplete only", () => {
		it("returns false for 1 char", () => {
			assert.strictEqual(shouldShowFullResults("a"), false);
		});

		it("returns false for 2 chars", () => {
			assert.strictEqual(shouldShowFullResults("ab"), false);
		});

		it("returns false for 3 chars", () => {
			assert.strictEqual(shouldShowFullResults("abc"), false);
		});

		it("returns false for empty string", () => {
			assert.strictEqual(shouldShowFullResults(""), false);
		});
	});

	describe("longer queries (>3 chars) - full results", () => {
		it("returns true for 4 chars", () => {
			assert.strictEqual(shouldShowFullResults("abcd"), true);
		});

		it("returns true for long query", () => {
			assert.strictEqual(shouldShowFullResults("climate change"), true);
		});
	});

	describe("edge cases", () => {
		it("counts actual characters, not bytes", () => {
			assert.strictEqual(shouldShowFullResults("café"), true); // 4 chars
		});

		it("trims whitespace before counting", () => {
			assert.strictEqual(shouldShowFullResults("  ab  "), false); // 2 chars after trim
		});
	});
});
