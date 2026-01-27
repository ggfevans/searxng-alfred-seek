# CLAUDE.md

Development conventions and context for AI-assisted development on this project.

## Project Overview

Alfred workflow for searching a personal SearXNG instance. Written in JXA (JavaScript for Automation).

## Development Workflow

### Git Worktrees Required

All feature work MUST use git worktrees for isolation:

```bash
# Create worktree for issue work
git worktree add .worktree/Alfred-SearXNG-Workflow-issue-<N> -b <type>/<N>-<description>

# Examples:
git worktree add .worktree/Alfred-SearXNG-Workflow-issue-16 -b feat/16-testing-infrastructure
git worktree add .worktree/Alfred-SearXNG-Workflow-issue-2 -b fix/2-shell-injection
```

Branch naming: `<type>/<issue-number>-<short-description>`
- Types: `feat/`, `fix/`, `chore/`, `docs/`

### PR Required for All Changes

- No direct commits to `main`
- All changes via Pull Request
- PRs should reference the issue number

### Syncing with Alfred

The workflow lives in two places:
1. This git repo (source of truth)
2. Alfred's preferences folder (where it runs)

Use `just` commands to sync:
```bash
just transfer-changes-TO-local    # Push git changes to Alfred
just transfer-changes-FROM-local  # Pull Alfred changes to git
just open-local-workflow-in-alfred  # Open in Alfred for visual editing
```

Requires `.env` file with `WORKFLOW_UID` (copy from `.env.example`).

## Code Architecture

### JXA Constraints

JXA (JavaScript for Automation) runs in JavaScriptCore with ObjC bridge:
- No `require()` or ES modules
- No `fetch()` - use `curl` via `app.doShellScript()`
- No `URL` constructor - use regex parsing
- Global `$` and `ObjC` objects for macOS APIs
- Entry point is `run(argv)` function

### Code Organization Principles

**Testable vs Non-Testable Code:**

| Category | Examples | Testable in Node? |
|----------|----------|-------------------|
| Pure functions | `shellEscape`, `extractDomain`, `truncate` | Yes |
| JXA bridge code | `ObjC.import`, `$.getenv`, `app.doShellScript` | No |
| Alfred output | JSON structure generation | Yes (structure) |

**Current Structure:**
```
scripts/
└── search.js    # Monolithic JXA script (to be modularized)
```

**Future Structure (pattern from robbieg8s/alfred-workflows):**
```
src/
├── utils.js     # Pure functions (testable)
├── alfred.js    # Alfred JSON helpers (testable)
├── jxa.js       # JXA bridge code (not unit tested)
└── search.js    # Main entry point
```

## Testing

### Framework

Node.js built-in test runner (`node:test`) - no external dependencies.

```bash
npm test                    # Run all tests
node --test tests/          # Direct invocation
```

### What to Test

- **DO test:** Pure functions (`shellEscape`, `extractDomain`, `truncate`, `alfredMatcher`)
- **DO test:** Alfred JSON output structure
- **DO test:** Error handling paths with `assert.throws()` / `assert.rejects()`
- **DON'T test:** JXA-specific code (requires macOS runtime)

### Test Organization

```
tests/
├── data/              # Test fixtures
│   ├── responses/     # Sample API responses
│   └── edge-cases/    # Malformed inputs
├── shell-escape.test.js
└── utils.test.js
```

### Running Tests in CI

Tests run on every PR via GitHub Actions.

## Security Considerations

### Shell Injection Prevention

When calling shell commands via `app.doShellScript()`:
1. Always use `shellEscape()` for user-controlled values
2. Use `--` separator before URLs/paths to prevent option injection
3. Prefer single quotes over double quotes for escaping

```javascript
// GOOD
const cmd = `curl -- ${shellEscape(url)}`;

// BAD - vulnerable to injection
const cmd = `curl ${url}`;
```

### Environment Variables

All config comes from Alfred workflow variables:
- `searxng_url` - SearXNG instance URL
- `timeout_ms` - Request timeout

Validate before use - `parseInt()` can return `NaN`.

## Release Process

1. Update version in `info.plist`
2. Run `just release` to build `.alfredworkflow` bundle
3. GitHub Actions creates release on version tag

## References

- [SearXNG API](https://docs.searxng.org/dev/search_api.html)
- [Alfred Script Filter JSON](https://www.alfredapp.com/help/workflows/inputs/script-filter/json/)
- [JXA Cookbook](https://github.com/JXA-Cookbook/JXA-Cookbook)
- [robbieg8s/alfred-workflows](https://github.com/robbieg8s/alfred-workflows) - Testing patterns reference
