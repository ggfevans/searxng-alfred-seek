# Alfred-SearXNG-Workflow Design

## Overview

An Alfred workflow that searches a personal SearXNG instance and displays inline results directly in Alfred's interface.

**Primary Use Cases:**
- Quick web searches replacing browser search bar
- Research and reference lookups while working
- Privacy-focused searching via self-hosted SearXNG
- Multi-engine aggregated search results

## Architecture

```
Alfred-SearXNG-Workflow/
├── info.plist              # Alfred workflow config & variable definitions
├── icon.png                # Workflow icon for Alfred UI
├── scripts/
│   └── search.js           # Main Script Filter (JXA)
└── README.md               # User documentation
```

**Technology Choice: JavaScript (JXA)**

Rationale:
- Network latency dominates (80-90% of response time) — language speed is negligible
- No compilation step — edit and test immediately
- Native to macOS via JavaScript for Automation
- Proven pattern (gitfred uses same approach successfully)
- No external dependencies (npm, etc.)

## User Experience

### Keyword & Flow

**Keyword:** `sx`

```
User types "sx climate change"
    ↓
[Short query] → Show autocomplete suggestions
    ↓
[User pauses/selects] → Fetch full search results
    ↓
Results displayed inline in Alfred
    ↓
User selects result → Opens in browser
```

### Autocomplete

As user types, show search suggestions from SearXNG's autocomplete API:

```
sx clim
├── climate change
├── climbing gear
├── climate science
└── 🔎 Search "clim" in browser
```

Selecting a suggestion executes the full search.

### Result Display

```
┌─────────────────────────────────────────────────────┐
│ Page Title Here                                     │
│ reddit.com · Brief snippet of the page content...   │
└─────────────────────────────────────────────────────┘
```

**Subtitle format:** `{domain} · {snippet}`

The domain provides more signal than category emojis — users can see at a glance if a result is from Reddit, Stack Overflow, Wikipedia, etc.

### Fallback Item

Always include as the final result:

```
┌─────────────────────────────────────────────────────┐
│ 🔎 Search "query" in browser                        │
│ Open SearXNG web interface                          │
└─────────────────────────────────────────────────────┘
```

This escape hatch works even when:
- API is slow/timing out
- SearXNG returns errors
- User wants the full web UI experience

### Actions (Modifier Keys)

| Key | Action | Subtitle Hint |
|-----|--------|---------------|
| ⏎ Enter | Open URL in default browser | (default) |
| ⌘+C | Copy URL to clipboard | "⌘: Copy URL" |
| ⇧ Shift | Quick Look preview | (native Alfred) |
| ⌥ Option | Open in SearXNG web UI | "⌥: View in SearXNG" |

## Configuration

**Alfred Workflow Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `searxng_url` | Yes | — | SearXNG instance URL (e.g., `https://search.example.com`) |
| `timeout_ms` | No | `5000` | Request timeout in milliseconds |

All other settings (safe search, language, default engines) should be configured in the SearXNG instance itself, not per-workflow.

## Error Handling

### Strategy

Errors display AS Alfred items with actionable fallbacks — never silent failures.

### Network Resilience

1. **Offline detection:** Check network connectivity before API call
2. **Retry logic:** Auto-retry once on timeout before showing error
3. **Graceful degradation:** Always show "Search in browser" fallback

### Error States

| Error Type | Title | Subtitle | Action |
|------------|-------|----------|--------|
| Network unreachable | ⚠️ Cannot reach SearXNG | Check your connection | Opens SearXNG URL |
| Timeout | ⏱️ Search timed out | Press Enter to try in browser | Opens search in browser |
| JSON parse error | ❌ Invalid response | Check if JSON format is enabled | Opens SearXNG settings doc |
| Empty results | 🔍 No results found | Try different keywords | Opens search in browser |
| API disabled | 🔒 JSON API not enabled | Enable in SearXNG settings.yml | Opens SearXNG docs |

## Technical Implementation

### SearXNG API

**Search endpoint:**
```
GET {searxng_url}/search?q={query}&format=json
```

**Autocomplete endpoint:**
```
GET {searxng_url}/autocompleter?q={query}
```

**Response fields used:**
- `title` — Result title
- `url` — Result URL
- `content` — Snippet text
- `parsed_url.netloc` — Domain for subtitle (extracted client-side if not present)

### Alfred Script Filter Output

```javascript
{
  items: [
    {
      title: "Page Title",
      subtitle: "example.com · Snippet text here...",
      arg: "https://example.com/page",
      quicklookurl: "https://example.com/page",
      match: "page title example snippet",
      mods: {
        cmd: { arg: "https://example.com/page", subtitle: "⌘: Copy URL" },
        alt: { arg: "https://searxng/search?q=query", subtitle: "⌥: View in SearXNG" }
      }
    },
    // ... more results
    {
      title: "🔎 Search \"query\" in browser",
      subtitle: "Open SearXNG web interface",
      arg: "https://searxng/search?q=query"
    }
  ],
  cache: { seconds: 60, loosereload: true }
}
```

### Performance Optimizations

1. **Alfred caching:** Results cached for 60 seconds with `loosereload: true`
2. **Client-side filtering:** Set `match` field so Alfred filters locally without re-running script
3. **Debounced autocomplete:** Only fetch suggestions after typing pause
4. **Single HTTP request:** One curl call per search (no pagination for v1)

## Prerequisites

### SearXNG Configuration

The SearXNG instance must have JSON format enabled in `settings.yml`:

```yaml
search:
  formats:
    - html
    - json  # Required for this workflow
```

### Alfred

- Alfred 5+ with Powerpack license (required for workflows)
- macOS (JXA is macOS-only)

## Future Considerations (Out of Scope for v1)

- Separate keywords per category (`sxi` for images, etc.)
- Search history / frecency
- Favicon caching
- Multiple SearXNG instance support

## References

- [SearXNG Search API Documentation](https://docs.searxng.org/dev/search_api.html)
- [Alfred Script Filter JSON Format](https://www.alfredapp.com/help/workflows/inputs/script-filter/json/)
- [gitfred workflow](https://github.com/chrisgrieser/gitfred) — reference implementation
