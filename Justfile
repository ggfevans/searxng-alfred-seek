set quiet := true
set dotenv-load := true

# WORKFLOW_UID comes from .env file
# Create .env from .env.example and set your workflow folder name

# Alfred preferences location (handles both synced and non-synced setups)
prefs_location := `defaults read com.runningwithcrayons.Alfred-Preferences syncfolder 2>/dev/null | sed "s|^~|$HOME|" || echo "$HOME/Library/Application Support/Alfred"`
local_workflow := prefs_location / "Alfred.alfredpreferences/workflows" / env("WORKFLOW_UID", "")

#───────────────────────────────────────────────────────────────────────────────

# Sync changes FROM local Alfred workflow to this git repo
transfer-changes-FROM-local:
    #!/usr/bin/env zsh
    if [[ -z "$WORKFLOW_UID" ]]; then
        echo "Error: WORKFLOW_UID not set. Copy .env.example to .env and configure it."
        exit 1
    fi
    if [[ ! -d "{{ local_workflow }}" ]]; then
        echo "Error: Workflow not found at {{ local_workflow }}"
        echo "Check WORKFLOW_UID in .env matches your Alfred workflow folder"
        exit 1
    fi
    rsync --archive --delete --exclude-from="$PWD/.rsync-exclude" "{{ local_workflow }}/" "$PWD"
    git status --short

# Sync changes TO local Alfred workflow from this git repo
transfer-changes-TO-local:
    #!/usr/bin/env zsh
    if [[ -z "$WORKFLOW_UID" ]]; then
        echo "Error: WORKFLOW_UID not set. Copy .env.example to .env and configure it."
        exit 1
    fi
    if [[ ! -d "{{ local_workflow }}" ]]; then
        echo "Error: Workflow not found at {{ local_workflow }}"
        echo "Check WORKFLOW_UID in .env matches your Alfred workflow folder"
        exit 1
    fi
    rsync --archive --delete --exclude-from="$PWD/.rsync-exclude" "$PWD/" "{{ local_workflow }}"
    echo "\e[1;34mSynced to: {{ local_workflow }}\e[0m"

# Open workflow in Alfred Preferences for visual editing
[macos]
open-local-workflow-in-alfred:
    #!/usr/bin/env zsh
    open "alfredpreferences://navigateto/workflows>workflow>$WORKFLOW_UID"
    osascript -e "tell application id \"com.runningwithcrayons.Alfred\" to reveal workflow \"$WORKFLOW_UID\""

# Run the release process
release:
    ./.build-and-release.sh

# Show where Alfred workflow is located
show-workflow-path:
    @echo "{{ local_workflow }}"
