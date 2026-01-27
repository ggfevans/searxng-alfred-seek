# Roadmap

This document outlines the planned development path for Alfred-SearXNG-Workflow.

## Philosophy

- **Minimal & focused** - Only add features that significantly improve the core search experience
- **Community-ready** - Polish, documentation, and ease of contribution matter
- **YAGNI** - Features are added when genuinely needed, not speculatively

---

## Milestones

### v0.1.0 - Basic Workflow (Complete)

The initial working implementation:
- [x] Script Filter with `sx` keyword
- [x] SearXNG JSON API integration
- [x] Results display with title, domain, and snippet
- [x] Modifier keys: Enter (open), Cmd (copy), Alt (SearXNG web UI), Shift (Quick Look)
- [x] Error handling for network issues, missing config, empty results
- [x] 60-second caching with loose reload
- [x] User configuration for `searxng_url` and `timeout_ms`

---

### v0.1.1 - Bug Fixes & Hardening

Security and robustness fixes identified in code review.

#### Shell Injection Prevention
- **Issue:** URL is interpolated directly into curl command, allowing potential shell injection
- **Fix:** Escape single quotes in URL, wrap in single quotes, add `--` separator before URL
- **Priority:** High (security)

#### Timeout Validation
- **Issue:** `Number.parseInt()` can return `NaN` for non-numeric environment values
- **Fix:** Validate parsed timeout value, fallback to 5000ms default, optionally clamp to max
- **Priority:** Medium (robustness)

---

### v0.2.0 - Core Enhancements

Features that improve the daily search experience.

#### Favicons
Display website favicons next to search results instead of the generic workflow icon.

- Fetch favicon from result domains (e.g., `https://example.com/favicon.ico`)
- Cache favicons locally in Alfred's workflow data folder
- Fallback to generic icon if favicon unavailable
- Consider async/caching strategy given JXA limitations

#### Autocomplete Suggestions
Show search suggestions as you type, before executing the full search.

- Use SearXNG's `/autocompleter?q={query}` endpoint
- Display suggestions for short/in-progress queries
- Selecting a suggestion triggers full search
- Always include "Search {query} directly" as fallback
- May require separate Script Filter or mode detection

---

### v0.3.0 - Power User Features

Features for users who want more control over their searches.

#### Category Keywords
Separate keywords for specific content types:

| Keyword | Category | Notes |
|---------|----------|-------|
| `sxi` | Images | Show thumbnails where available |
| `sxn` | News | Show publish dates |
| `sxv` | Videos | Show video thumbnails |
| `sxf` | Files | - |
| `sxit` | IT/Tech | - |
| `sxm` | Music | - |

Each keyword adds `&categories={category}` to the API request.

#### Time Range Filter
Filter results by recency using query modifiers:

| Modifier | Range | Example |
|----------|-------|---------|
| `!d` | Last day | `sx!d python tutorials` |
| `!w` | Last week | `sx!w python tutorials` |
| `!m` | Last month | `sx!m breaking news` |
| `!y` | Last year | `sx!y annual report` |

Show indicator in subtitle: "Last day · domain.com · snippet..."

#### Configurable Keywords
Allow users to customize trigger keywords through workflow settings:
- General search keyword (default: `sx`)
- Category keywords (defaults: `sxi`, `sxn`, `sxv`, etc.)
- Validation and sensible defaults

---

### v1.0.0 - Gallery Ready

The official release, ready for Alfred Gallery submission.

#### Documentation
- Comprehensive README with:
  - Installation instructions
  - Screenshots of search results, modifiers, error states
  - Troubleshooting guide (JSON API, CAPTCHA, timeouts)
  - Configuration reference
- In-workflow README (Alfred's built-in documentation)

#### Preferences Screen Layout
Improve workflow configuration UI:
- Left panel: organized configuration groups
- Right panel: readme/changelog for reference
- Logical grouping of related settings

#### CI/CD Polish
- Verify release workflow creates proper `.alfredworkflow` bundle
- Ensure linting and checks are in place
- Test release process end-to-end

#### Development Workflow (CLAUDE.md)
- Document git worktree requirement for feature work
- Document PR requirement for all changes
- Establish testing expectations

#### Alfred Gallery Submission
- Meet all Alfred Gallery requirements
- Create compelling gallery listing
- Submit for review

---

## Out of Scope

Features explicitly not planned:

- **Search history / frecency** - Alfred handles this natively with UID
- **Multiple SearXNG instances** - Adds complexity, unclear use case
- **Infoboxes** - Alfred UI too limited for rich card display
- **Pagination** - First page results are sufficient for quick searches

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to help with roadmap items.

Issues are labeled by milestone (`v0.1.1`, `v0.2.0`, etc.) for easy filtering.
