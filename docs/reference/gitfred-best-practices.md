# GitFred Best Practices Reference

A comprehensive analysis of implementation patterns from [chrisgrieser/gitfred](https://github.com/chrisgrieser/gitfred), a mature Alfred workflow for GitHub operations.

## 1. Workflow Structure

### info.plist Organization

GitFred demonstrates a well-organized info.plist with clear separation of concerns:

**Key structural elements:**
- **bundleid**: Uses reverse domain notation (`de.chris-grieser.github`)
- **category**: Visual categorization with emoji ("star" category)
- **readme**: Comprehensive inline documentation with usage instructions, keyboard shortcuts, and configuration guidance

**Script Filter Configuration:**
```xml
<key>scriptfile</key>
<string>scripts/my-github-repos.js</string>
<key>alfredfiltersresults</key>
<true/>
<key>alfredfiltersresultsmatchmode</key>
<integer>2</integer>
```

Key settings:
- `alfredfiltersresults: true` - Let Alfred handle filtering (when results have `match` property)
- `alfredfiltersresultsmatchmode: 2` - Use "word starts with" matching
- `queuemode: 1` - Wait until user stops typing before executing
- `queuedelayimmediatelyinitially: true` - Show results immediately on first trigger

### Script Connections

Scripts connect to triggers via UUIDs in the `connections` dict. The workflow uses:
- **Conditionals** (`alfred.workflow.utility.conditional`) for branching logic
- **Junctions** (`alfred.workflow.utility.junction`) to merge multiple paths
- **External triggers** (`alfred.workflow.output.callexternaltrigger`) for recursive workflows

**Example: Mode-based routing for notifications:**
```xml
<key>inputstring</key>
<string>{var:mode}</string>
<key>matchstring</key>
<string>read</string>
```

### Modifier Key Handling

Actions are connected with modifier flags:
- `0` = No modifier (default)
- `131072` = Shift
- `262144` = Control
- `524288` = Option
- `1048576` = Command

Each modifier connection specifies a `modifiersubtext` for user guidance.

---

## 2. Release and Distribution

### Build Script (`.build-and-release.sh`)

A sophisticated release process:

```bash
#!/bin/zsh

# 1. Get current version and prompt for next
current_version=$(plutil -extract version xml1 -o - info.plist | sed -n 's/.*<string>\(.*\)<\/string>.*/\1/p')
echo "current version: $current_version"
echo -n "   next version: "
read -r next_version

# 2. Update version in BOTH repo and local workflow
plutil -replace version -string "$next_version" info.plist
plutil -replace version -string "$next_version" "$local_info_plist"

# 3. Copy download link for issue responses
msg="Available in the Alfred Gallery in 1-2 days, or directly..."
url="https://github.com/$repo/releases/download/$next_version/$workflow_uid.alfredworkflow"
echo -n "$msg $url" | pbcopy

# 4. Auto-generate changelog from commit messages
changelog=$(git log "$last_release_commit"..HEAD --format='- %s' |
    grep --extended-regexp --invert-match '^- (build|ci|release|chore|test|style)')

# 5. Auto-open Alfred Gallery update request
open "https://github.com/alfredapp/gallery-edits/issues/new?..."

# 6. Commit, tag, and push
git add --all && git commit -m "release: $next_version" && git push
git tag "$next_version" && git push origin --tags
```

**Key innovations:**
- Automatic changelog generation from conventional commits
- Copies release message to clipboard for issue responses
- Opens Alfred Gallery submission form pre-filled
- Tags trigger CI/CD workflow

### GitHub Actions Release Workflow

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

**Key points:**
- Runs on `macos-latest` for proper zip handling
- Uses `--symlinks` to preserve symlinks
- Excludes dev files from the .alfredworkflow bundle
- Auto-generates release notes from commits

---

## 3. Development Workflow

### Justfile Commands

```just
set quiet := true

# Determine paths dynamically
workflow_uid := `basename "$PWD"`
prefs_location := `defaults read com.runningwithcrayons.Alfred-Preferences syncfolder | sed "s|^~|$HOME|"`
local_workflow := prefs_location / "Alfred.alfredpreferences/workflows" / workflow_uid

# Sync changes FROM local Alfred to repo
transfer-changes-FROM-local:
    rsync --archive --delete --exclude-from="$PWD/.rsync-exclude" "{{ local_workflow }}/" "$PWD"
    git status --short

# Sync changes TO local Alfred from repo
transfer-changes-TO-local:
    rsync --archive --delete --exclude-from="$PWD/.rsync-exclude" "$PWD/" "{{ local_workflow }}"

# Open workflow in Alfred for editing
[macos]
open-local-workflow-in-alfred:
    open "alfredpreferences://navigateto/workflows>workflow>{{ workflow_uid }}"
    osascript -e 'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "{{ workflow_uid }}"'

release:
    ./.build-and-release.sh
```

**Critical insight**: The folder name MUST match the workflow UID for this system to work.

### rsync-exclude File

Controls what syncs between repo and local:
```gitignore
# git
.git/
.gitignore

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
.editorconfig
biome.jsonc
*.d.ts
jsconfig.json
```

---

## 4. UX Polish

### User Feedback

**Contextual subtitles:**
```javascript
const subtitle = `${typeIcon} ${reasonIcon}  ${notif.repository.name}  ·  ${updatedAt}`;
```

**Emoji status indicators:**
```javascript
const typeMaps = {
    PullRequest: "PR",
    Issue: "Issue",
    Discussion: "Disc",
    CheckSuite: "CI",
    Release: "Rel",
};

// Issue state icons
if (item.state === "open") icon += "Open ";
else if (item.state_reason === "not_planned") icon += "Skipped ";
else if (item.state_reason === "completed") icon += "Done ";
```

**Short number formatting:**
```javascript
function shortNumber(starcount) {
    const starStr = starcount.toString();
    if (starcount < 2000) return starStr;
    return starStr.slice(0, -3) + "k";
}
```

### Human-Readable Relative Dates

```javascript
function humanRelativeDate(isoDateStr) {
    const deltaMins = (Date.now() - new Date(isoDateStr).getTime()) / 1000 / 60;
    let unit, delta;

    if (deltaMins < 60) {
        unit = "minute"; delta = Math.floor(deltaMins);
    } else if (deltaMins < 60 * 24) {
        unit = "hour"; delta = Math.floor(deltaMins / 60);
    } // ... more ranges

    const formatter = new Intl.RelativeTimeFormat("en", { style: "narrow", numeric: "auto" });
    return formatter.format(-delta, unit).replace(/m(?= ago$)/, "min");
}
```

### Intelligent Modifier Subtitles

```javascript
mods: {
    cmd: {
        arg: notif.id,
        valid: !showReadNotifs,
        subtitle: showReadNotifs ? "Already marked as read" : "Cmd: Mark as Read",
        variables: { mode: "read", notificationsLeft: responseObj.length - 1 },
    },
    alt: {
        subtitle: notifApiUrl ? "Opt: Copy URL" : "(No URL)",
        valid: Boolean(notifApiUrl),
        variables: { mode: "copy" },
    },
}
```

### Notifications for User Actions

```xml
<key>title</key>
<string>Cloning...</string>
```

```xml
<key>title</key>
<string>Copied: {query}</string>
```

---

## 5. Icon Handling

GitFred uses a single `icon.png` at the root level. Icons are referenced in script output:
- No per-item icons in the codebase - relies on emoji prefixes in titles
- Workflow icon used as default for all results

**Best practice:** Use emoji in titles for quick visual scanning rather than separate icon files.

---

## 6. Code Quality

### Biome Configuration

```jsonc
{
    "linter": {
        "domains": { "project": "none" },  // standalone JS files
        "rules": {
            "performance": {
                "noAwaitInLoops": "on",
                "noBarrelFile": "on"
            },
            "style": {
                "noInferrableTypes": "on",
                "noNestedTernary": "on",
                "noProcessEnv": "on",
                "useForOf": "on",
                "useNamingConvention": "on",
                "useNumericSeparators": "on"
            },
            "suspicious": {
                "noConstantBinaryExpressions": "on",
                "noVar": "on",
                "useAwait": "on",
                "useErrorMessage": "on"
            }
        }
    },
    "javascript": {
        "globals": ["$", "Application", "ObjC", "Path", "delay"]  // JXA globals
    },
    "formatter": {
        "useEditorconfig": true,
        "lineWidth": 100,
        "formatWithErrors": true
    }
}
```

**Key insight:** Declares JXA globals to prevent false positives.

### TypeScript Declarations for JXA

```typescript
// github-api.d.ts
declare class GithubRepo {
    // biome-ignore lint/style/useNamingConvention: not_by_me
    full_name: string;
    name: string;
    // biome-ignore lint/style/useNamingConvention: not_by_me
    html_url: string;
    // ...
}
```

Uses `biome-ignore` comments for external API naming conventions.

### JSDoc Type Annotations

```javascript
/** @type {AlfredRun} */
// biome-ignore lint/correctness/noUnusedVariables: Alfred run
function run() {
    // ...
}

/**
 * @param {string} url
 * @param {string[]} headers
 * @return {string} response
 */
function httpRequestWithHeaders(url, headers) {
    // ...
}
```

---

## 7. Performance Tricks

### Alfred's Built-in Cache

```javascript
return JSON.stringify({
    items: repos,
    cache: { seconds: 15, loosereload: true }
});
```

- `loosereload: true` allows showing stale results while fetching fresh data
- Short cache (15s) for rapidly-changing data like cloned repos
- Longer cache (150s) for relatively stable data like issues

### Pagination Performance Option

```javascript
const only100repos = $.getenv("only_100_recent_repos") === "1";

while (true) {
    // ... fetch page
    if (only100repos) break;  // PERF: only one request when user enabled this
    if (reposOfPage.length < 100) break;
}
```

User-configurable performance vs completeness tradeoff.

### Alfred Matcher Function

```javascript
function alfredMatcher(str) {
    const clean = str.replace(/[-_.]/g, " ");
    const camelCaseSeparated = str.replace(/([A-Z])/g, " $1");
    return [clean, camelCaseSeparated, str].join(" ") + " ";
}
```

Generates multiple searchable variants for better matching.

### Local State Detection

```javascript
// Check for local repos efficiently
const localRepoPaths = app
    .doShellScript(`find ${localRepoFolder} -type d -maxdepth 2 -name ".git"`)
    .split("\r");

for (const gitFolderPath of localRepoPaths) {
    // Build lookup map
    localRepos[name] = repo;
}
```

Builds a lookup map once, then uses O(1) lookups.

---

## 8. Alfred-Specific Features

### Configurable Keywords via Variables

```xml
<key>keyword</key>
<string>{var:keyword_public_repos}</string>
```

Keywords are user-configurable through workflow settings.

### External Triggers for Recursive Workflows

```xml
<key>externaltriggerid</key>
<string>github-notifications</string>
<key>workflowbundleid</key>
<string>self</string>
```

Allows the workflow to call itself, used for "show read notifications" toggle.

### Script Filter Inbound Config

```xml
<key>inboundconfig</key>
<dict>
    <key>externalid</key>
    <string>github-notifications</string>
    <key>inputmode</key>
    <integer>1</integer>
</dict>
```

Enables external triggering of script filters.

### Hotkey with Browser Automation

```xml
<key>taskuid</key>
<string>com.alfredapp.automation.extras/web-browsers/frontmost-browser/frontmost.tabs.current</string>
```

Uses Alfred's automation tasks to get the current browser URL.

### Conditional Routing with Regex

```xml
<key>matchmode</key>
<integer>4</integer>  <!-- regex mode -->
<key>matchstring</key>
<string>.*github.com/.+?/.+</string>
```

### Browse in Terminal Action

```xml
<key>type</key>
<string>alfred.workflow.action.browseinterminal</string>
```

Opens paths directly in the configured terminal app.

### Alfred Knowledge (Frecency)

```javascript
uid: useAlfredFrecency ? repo.full_name : undefined,
```

Optional UID enables Alfred's learning algorithm for frequently-used items.

### Quicklook URLs

```javascript
quicklookurl: repo.private ? undefined : mainArg,
```

Enables spacebar preview for public URLs.

---

## 9. GitHub Workflows

### Comprehensive CI Setup

1. **biome.yml** - JavaScript linting on push/PR
2. **pr-title.yml** - Enforces conventional commit titles with semantic-pull-request action
3. **rumdl-lint.yml** - Markdown linting
4. **stale-bot.yml** - Auto-closes inactive issues
5. **alfred-workflow-release.yml** - Automated releases on tag

### Dependabot for Actions

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "chore(dependabot): "
```

---

## 10. User Configuration Best Practices

### Well-Organized Settings

GitFred's `userconfigurationconfig` demonstrates:

1. **Grouped related settings** - GitHub credentials together, cloning options together
2. **Clear descriptions** - Each setting explains its purpose and impact
3. **Sensible defaults** - Works out of the box, customizable for power users
4. **Cascading fallbacks** - Token from config -> shell command -> .zshenv

### Configuration Types Used

- `textfield` - For strings (username, token, branch name)
- `checkbox` - For boolean toggles
- `filepicker` - For folder selection with filtermode
- `slider` - For numeric ranges with markers
- `popupbutton` - For enumerated options

### Example: Cascading Token Resolution

```javascript
function getGithubToken() {
    // 1. Direct config value
    let githubToken = $.getenv("github_token_from_alfred_prefs").trim();

    // 2. Shell command fallback
    if (!githubToken && tokenShellCmd) {
        githubToken = app.doShellScript(tokenShellCmd + " || true").trim();
    }

    // 3. Environment variable fallback
    if (!githubToken) {
        githubToken = app.doShellScript(
            "test -e $HOME/.zshenv && source $HOME/.zshenv ; echo $GITHUB_TOKEN"
        );
    }

    return githubToken;
}
```

---

## 11. Error Handling Patterns

### Guard Clauses with User Feedback

```javascript
// GUARD no response
if (!response) {
    return JSON.stringify({
        items: [{ title: "No response from GitHub.", subtitle: "Try again later.", valid: false }],
    });
}

// GUARD API errors
if (responseObj.message) {
    const item = { title: "Request denied.", subtitle: responseObj.message, valid: false };
    return JSON.stringify({ items: [item] });
}

// GUARD no results
if (repos.length === 0) {
    repos.push({
        title: "No results",
        subtitle: `No results found for '${query}'`,
        valid: false,
        mods: {
            shift: { valid: false },
            cmd: { valid: false },
            alt: { valid: false },
            ctrl: { valid: false },
        },
    });
}
```

### Shell Script Error Handling

```bash
# GUARD
if [[ -z "$next_version" || "$next_version" == "$current_version" ]]; then
    print "\e[1;31mInvalid version number.\e[0m"
    return 1
fi

# Error propagation with message
if [[ $success -ne 0 ]]; then
    echo "ERROR: Clone failed. $msg"
    return 1
fi
```

---

## Summary: Key Takeaways

1. **Use external script files** (`scriptfile`) rather than inline scripts
2. **Implement Alfred's cache** with appropriate TTLs for your data freshness needs
3. **Provide user feedback** via notifications and dynamic subtitles
4. **Make keywords configurable** via workflow variables
5. **Use Biome** for JavaScript linting with JXA globals declared
6. **Create TypeScript declarations** for API response types
7. **Implement cascading fallbacks** for credentials
8. **Use guard clauses** with informative error messages
9. **Automate releases** with tag-triggered GitHub Actions
10. **Maintain sync** between repo and local workflow with rsync + Justfile
