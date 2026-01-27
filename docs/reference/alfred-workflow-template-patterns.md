# Alfred Workflow Template Patterns

Analysis of Chris Grieser's `alfred-workflow-template` repository for adoption in Alfred-SearXNG-Workflow.

Source: `/Users/gvns/code/3rd-party/alfred-workflow-template`
Reference implementation: `/Users/gvns/code/3rd-party/gitfred`

---

## 1. Project structure

### Template structure (minimal)

```
alfred-workflow-template/
├── .build-and-release.sh      # Release automation script
├── .editorconfig              # Code style consistency
├── .gitattributes             # Mark info.plist as generated
├── .gitignore                 # Ignore .DS_Store, prefs.plist, *.alfredworkflow
├── .rsync-exclude             # Files to exclude when syncing to/from Alfred
├── .rumdl.toml                # Markdown linter config
├── .github/
│   ├── FUNDING.yml            # Sponsor button config
│   ├── dependabot.yml         # Auto-update GitHub Actions
│   ├── pull_request_template.md
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   ├── config.yml
│   │   └── feature_request.yml
│   └── workflows/
│       ├── alfred-workflow-release.yml  # Build .alfredworkflow on tag
│       ├── pr-title.yml                 # Enforce conventional commits
│       ├── rumdl-lint.yml               # Markdown linting
│       └── stale-bot.yml                # Auto-close stale issues
├── BOOTSTRAP.sh               # Template initialization script
├── Justfile                   # Development commands
├── LICENSE                    # MIT with {{year}} placeholder
└── README.md                  # Template with {{placeholders}}
```

### Production workflow structure (gitfred)

```
gitfred/
├── .build-and-release.sh
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .rsync-exclude
├── .rumdl.toml
├── .harper-dictionary.txt     # Project-specific spelling
├── .github/                   # Same structure as template
│   └── workflows/
│       └── biome.yml          # JavaScript linting (project-specific)
├── biome.jsonc                # JS/TS linter config (project-specific)
├── github-api.d.ts            # TypeScript definitions (project-specific)
├── icon.png                   # Workflow icon (required)
├── info.plist                 # Alfred workflow definition (required)
├── Justfile
├── LICENSE
├── README.md
└── scripts/                   # Workflow scripts (project-specific)
    ├── clone-repo.sh
    ├── github-notifications.js
    ├── my-github-issues.js
    └── ...
```

### Key observations

1. **Flat structure** - No nested src/ or lib/ directories; scripts at root or in `scripts/`
2. **info.plist at root** - Required by Alfred
3. **icon.png at root** - Required by Alfred
4. **No package.json** - Uses built-in JXA/JavaScript, not Node.js
5. **TypeScript definitions optional** - `.d.ts` files for IDE support without compilation

---

## 2. Boilerplate files

### Essential files for any workflow

| File | Purpose | Adopt? |
|------|---------|--------|
| `.editorconfig` | Consistent formatting across editors | Yes |
| `.gitattributes` | Mark `info.plist` as generated for GitHub stats | Yes |
| `.gitignore` | Ignore `.DS_Store`, `prefs.plist`, `*.alfredworkflow` | Yes |
| `.rsync-exclude` | Exclude dev files from Alfred sync | Yes |
| `Justfile` | Development commands | Yes |
| `.build-and-release.sh` | Release automation | Yes |
| `LICENSE` | MIT license | Yes |
| `README.md` | Documentation | Yes |

### .gitignore content

```gitignore
# Mac
.DS_Store

# Alfred
prefs.plist
*.alfredworkflow
```

### .gitattributes content

```
# mark as generated files for github stats & diffs
info.plist linguist-generated
```

### .rsync-exclude content

Files excluded from Alfred workflow sync (development-only files):

```gitignore
# git
.git/
.gitignore
.gitattributes

# Alfred
prefs.plist
.rsync-exclude

# docs
docs/
LICENSE
/README.md

# build
Justfile
.github/
.build-and-release.sh

# linter & types
.harper-dictionary.txt
.typos.toml
.editorconfig
.rumdl.toml
.rumdl_cache
jxa-globals.d.ts
jsconfig.json
alfred.d.ts

# other
*.shortcut
```

### .editorconfig content

```ini
root = true

[*]
max_line_length = 100
end_of_line = lf
charset = utf-8
insert_final_newline = true
indent_style = tab
indent_size = 3
tab_width = 3
trim_trailing_whitespace = true

[*.{yml,yaml,scm,cff}]
indent_style = space
indent_size = 2
tab_width = 2

[*.py]
indent_style = space
indent_size = 4
tab_width = 4

[*.md]
indent_style = space
indent_size = 4
trim_trailing_whitespace = false
```

---

## 3. Build/release automation

### Justfile commands

```just
set quiet := true

workflow_uid := `basename "$PWD"`
prefs_location := `defaults read com.runningwithcrayons.Alfred-Preferences syncfolder | sed "s|^~|$HOME|"`
local_workflow := prefs_location / "Alfred.alfredpreferences/workflows" / workflow_uid

# Sync changes FROM local Alfred to git repo
transfer-changes-FROM-local:
    rsync --archive --delete --exclude-from="$PWD/.rsync-exclude" "{{ local_workflow }}/" "$PWD"
    git status --short

# Sync changes TO local Alfred from git repo
transfer-changes-TO-local:
    rsync --archive --delete --exclude-from="$PWD/.rsync-exclude" "$PWD/" "{{ local_workflow }}"

# Open workflow in Alfred preferences
open-local-workflow-in-alfred:
    open "alfredpreferences://navigateto/workflows>workflow>{{ workflow_uid }}"

# Trigger release process
release:
    ./.build-and-release.sh
```

**Key pattern**: The git repo folder name MUST match the Alfred workflow folder name for rsync to work.

### .build-and-release.sh script

Release workflow:

1. Prompt for next version number
2. Update version in both repo and local `info.plist` files
3. Copy release URL to clipboard (for closing issues)
4. Auto-generate changelog from commits (excluding build/ci/chore types)
5. Open Alfred Gallery update submission form with pre-filled data
6. Commit, tag, and push to trigger GitHub Actions release

```bash
# Version update
plutil -replace version -string "$next_version" info.plist

# Changelog generation (for Alfred Gallery)
changelog=$(git log "$last_release_commit"..HEAD --format='- %s' |
    grep --extended-regexp --invert-match '^- (build|ci|release|chore|test|style)')

# Alfred Gallery submission URL
open "https://github.com/alfredapp/gallery-edits/issues/new?template=02_update_workflow.yml&..."

# Commit pattern
git commit -m "release: $next_version"
git tag "$next_version"
git push origin --tags
```

### GitHub Actions: alfred-workflow-release.yml

Triggered on any tag push:

```yaml
name: Alfred Workflow Release

on:
  push:
    tags: ["*"]

jobs:
  build:
    runs-on: macos-latest
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v6

      - name: Build .alfredworkflow
        run: |
          zip --recurse-paths --symlinks "${{ env.WORKFLOW_NAME }}.alfredworkflow" . \
            --exclude "README.md" ".git*" "Justfile" ".build-and-release.sh" \
            ".rsync-exclude" ".editorconfig" ".typos.toml" ".markdownlint.*"

      - uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          files: ${{ env.WORKFLOW_NAME }}.alfredworkflow
```

**Key pattern**: Uses `generate_release_notes: true` for auto-generated release notes from commits.

### Other GitHub Actions

| Workflow | Purpose |
|----------|---------|
| `pr-title.yml` | Enforce conventional commit format on PR titles |
| `rumdl-lint.yml` | Lint markdown files on push/PR |
| `stale-bot.yml` | Close issues after 180 days of inactivity |

---

## 4. Development setup

### Prerequisites

- Alfred with Powerpack license
- `just` command runner (`brew install just`)
- Git repo folder name matching Alfred workflow folder name

### Development workflow

1. **Initial setup**:
   - Clone template or create new repo
   - Create workflow in Alfred with matching folder name
   - Run `BOOTSTRAP.sh` (if using template) or manually configure

2. **Development cycle**:
   ```bash
   # After making changes in Alfred Preferences
   just transfer-changes-FROM-local

   # After making changes in code editor
   just transfer-changes-TO-local

   # Open workflow in Alfred for visual editing
   just open-local-workflow-in-alfred
   ```

3. **Release**:
   ```bash
   just release
   ```

### Testing and debugging

- Alfred's built-in debugger: `Cmd+D` in workflow editor
- Console.app for JXA debugging
- No automated testing framework (manual testing)

---

## 5. info.plist structure

### Required metadata fields

```xml
<key>bundleid</key>
<string>com.yourname.workflow-name</string>

<key>name</key>
<string>Workflow Name</string>

<key>description</key>
<string>Brief description</string>

<key>createdby</key>
<string>Your Name</string>

<key>version</key>
<string>1.0.0</string>

<key>webaddress</key>
<string>https://yoursite.com/</string>

<key>category</key>
<string>Productivity</string>  <!-- or emoji like ⭐️ -->
```

### Optional but recommended

```xml
<key>readme</key>
<string>Detailed usage instructions shown in Alfred Preferences</string>

<key>userconfigurationconfig</key>
<array>
    <!-- User-configurable variables -->
</array>
```

### User configuration pattern (from gitfred)

Variables are defined in `userconfigurationconfig` array with:
- `variable` - Variable name
- `label` - Display label
- `description` - Help text
- `type` - textfield, checkbox, filepicker, popupbutton
- `config` - Type-specific config (placeholder, default, options)

```xml
<dict>
    <key>config</key>
    <dict>
        <key>default</key>
        <string></string>
        <key>placeholder</key>
        <string>github.company.com</string>
    </dict>
    <key>description</key>
    <string>For GitHub Enterprise. If empty, uses github.com.</string>
    <key>label</key>
    <string>GitHub Enterprise URL</string>
    <key>type</key>
    <string>textfield</string>
    <key>variable</key>
    <string>enterprise_url</string>
</dict>
```

---

## 6. Documentation patterns

### README.md structure

```markdown
# Workflow Name
![GitHub downloads badge](...)
![Alfred Gallery downloads badge](...)  <!-- Optional, requires Gallery ID -->
![Latest release badge](...)

Brief description.

- [ ] Showcase image to be inserted here.

## Usage
- Action via keyword `xxx`.
    - <kbd>Cmd</kbd><kbd>Return</kbd> does X.
    - <kbd>Opt</kbd><kbd>Return</kbd> does Y.
- Hotkey for quick action.

## Installation
[Download the latest release.](link)

## About the developer
Bio and links.
```

### Keyboard shortcut notation

Use `<kbd>` tags for keyboard shortcuts:
- `<kbd>⌘</kbd><kbd>⏎</kbd>` for Cmd+Return
- `<kbd>⌥</kbd><kbd>⏎</kbd>` for Opt+Return
- `<kbd>⌃</kbd><kbd>⏎</kbd>` for Ctrl+Return
- `<kbd>⇧</kbd><kbd>⏎</kbd>` for Shift+Return

### Badge URLs

```markdown
![GitHub downloads](https://img.shields.io/github/downloads/USER/REPO/total?label=GitHub%20Downloads&style=plastic&logo=github)
![Latest release](https://img.shields.io/github/v/release/USER/REPO?label=Latest%20Release&style=plastic)
```

---

## 7. Alfred Gallery submission

### Submission process

1. **Initial submission**: Manual via https://www.alfredforum.com/forum/3-share-your-workflows/
2. **Updates**: Via GitHub issue at https://github.com/alfredapp/gallery-edits/issues/new

### Automated in .build-and-release.sh

The release script auto-opens the Gallery update form with:
- Workflow repo URL
- New version number
- Changelog (generated from commits)

```bash
open "https://github.com/alfredapp/gallery-edits/issues/new?template=02_update_workflow.yml&title=Update+Workflow:+$repo&gallery_url=$gallery_url&new_version=$next_version&changelog=$changelog"
```

### Changelog filtering

Only user-facing changes are included:
```bash
grep --extended-regexp --invert-match '^- (build|ci|release|chore|test|style)'
```

---

## 8. Template vs project differences

### Template-only files (remove after setup)

| File | Purpose |
|------|---------|
| `BOOTSTRAP.sh` | Replaces {{placeholders}}, syncs from local, commits |

### Project-specific additions (gitfred examples)

| File | Purpose |
|------|---------|
| `icon.png` | Workflow icon (required) |
| `info.plist` | Workflow definition (required) |
| `scripts/` | Workflow scripts |
| `biome.jsonc` | JavaScript linter config |
| `*.d.ts` | TypeScript definitions |
| `.harper-dictionary.txt` | Project-specific spelling |

### Template placeholders

```
{{repo}}                  -> user/repo-name
{{owner}}                 -> user
{{workflow-id}}           -> repo-name
{{workflow-name}}         -> Repo Name (title case)
{{workflow-description}}  -> GitHub repo description
{{year}}                  -> Current year
```

---

## 9. Recommendations for Alfred-SearXNG-Workflow

### Immediate adoption

1. **Copy boilerplate files**:
   - `.editorconfig`
   - `.gitattributes`
   - `.gitignore` (merge with existing)
   - `.rsync-exclude`
   - `Justfile`
   - `.build-and-release.sh`

2. **Add GitHub workflows**:
   - `alfred-workflow-release.yml`
   - `pr-title.yml` (if using conventional commits)
   - `stale-bot.yml` (optional)

3. **Add issue templates**:
   - `bug_report.yml`
   - `feature_request.yml`
   - `config.yml`
   - `pull_request_template.md`

### Folder naming requirement

The git repository folder name MUST match the Alfred workflow folder name:
- Repo: `Alfred-SearXNG-Workflow`
- Alfred folder: `Alfred-SearXNG-Workflow`

### Suggested project structure

```
Alfred-SearXNG-Workflow/
├── .build-and-release.sh
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .rsync-exclude
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   ├── config.yml
│   │   └── feature_request.yml
│   ├── pull_request_template.md
│   └── workflows/
│       └── alfred-workflow-release.yml
├── docs/                    # Development documentation (excluded from workflow)
├── icon.png
├── info.plist
├── Justfile
├── LICENSE
├── README.md
└── scripts/
    └── searxng-search.js    # Main search script
```

### Version management

- Use semantic versioning (e.g., 1.0.0)
- Version stored in `info.plist`
- Updated via `plutil -replace version -string "X.Y.Z" info.plist`
- Tags trigger releases: `git tag 1.0.0 && git push origin --tags`

### Development notes

- Edit workflow visually in Alfred Preferences
- Sync changes bidirectionally with `just` commands
- Test with Alfred's debugger (`Cmd+D`)
- Release with `just release`
