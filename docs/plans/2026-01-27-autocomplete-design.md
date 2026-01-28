# Autocomplete Suggestions Design

**Date:** 2026-01-27
**Status:** Approved
**Issue:** #5

## Summary

Add smart autocomplete suggestions that appear while typing, with a threshold-based approach for performance optimization.

## User Experience

### Threshold Behavior

| Query Length | API Calls | Response Time | Display |
|--------------|-----------|---------------|---------|
| ≤3 chars | Autocomplete only | ~176ms | Suggestions + "Search for..." |
| >3 chars | Both (parallel) | ~1s | Results + Related Searches + "Search for..." |

### User Flow

```
User types: "cli" (≤3 chars)
  → Fast autocomplete suggestions:
    ├── climate change
    ├── climbing gear
    ├── climate science
    └── Search for "cli"...

User types: "climate" (>3 chars)
  → Full results + suggestions:
    ├── [Result] Climate Change - Wikipedia
    ├── [Result] NASA Climate
    ├── [Result] Climate.gov
    ├── ── Related searches ──
    ├── climate change effects
    ├── climate action
    └── Search for "climate"...
```

## API Integration

### Autocomplete Endpoint

```
GET /autocompleter?q={query}
Response: ["query", ["suggestion1", "suggestion2", ...]]
```

### Parallel Requests

For queries >3 chars, call both endpoints in parallel using shell backgrounding:

```bash
curl -s "${autocompleteUrl}" &
curl -s "${searchUrl}" &
wait
```

## Alfred Item Structure

### Autocomplete Suggestion

```javascript
{
  title: "climate change",
  subtitle: "Search for this suggestion",
  arg: "climate change",
  autocomplete: "climate change",
  icon: { path: "icon.png" },  // Reuse workflow icon
  variables: { action: "search" }
}
```

### "Search for {query}" Fallback

```javascript
{
  title: `Search for "${query}"`,
  subtitle: "Search your exact query",
  arg: query,
  icon: { path: "icon.png" },
  valid: true
}
```

### Visual Separator

```javascript
{
  title: "── Related searches ──",
  valid: false,
  icon: { path: "icon.png" }
}
```

## Bang Modifier Integration

Bangs are parsed first and inherited by suggestions:

```
User types: "!i cli"
  → Parse: category=images, cleanQuery="cli"
  → Autocomplete: "cli" suggestions
  → Selecting "climbing gear" → searches images for "climbing gear"
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Autocomplete fails | Show search results only |
| Search fails | Show autocomplete + error item |
| Both fail | Connection error + browser fallback |
| Autocomplete empty | Show search results (no separator) |

### Timeouts

- Autocomplete: 2s (fail fast)
- Search: Existing `timeout_ms` setting

## Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `scripts/search.js` | Add fetchAutocomplete(), threshold logic, combine results |

### New Functions

```javascript
function fetchAutocomplete(query, searxngUrl, timeout)
function suggestionToAlfredItem(suggestion, category, timeRange)
function buildResponse(query, cleanQuery, parsed, searchResults, suggestions)
```

### Testing

| Test | Method |
|------|--------|
| Autocomplete parsing | Unit test with mock JSON |
| Suggestion item structure | Unit test output shape |
| Threshold logic | Boundary tests (3 vs 4 chars) |
| Bang inheritance | Test context propagation |
| Error handling | Empty/failed response tests |

## Acceptance Criteria

- [x] Autocomplete suggestions appear while typing
- [x] Selecting a suggestion searches for that term
- [x] "Search exact query" option always available
- [x] Full results shown after threshold (>3 chars)
- [x] Graceful fallback if autocomplete unavailable
