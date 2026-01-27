#!/usr/bin/env node
/**
 * Sync version from package.json to info.plist
 *
 * Called automatically by npm's postversion hook to ensure
 * both files stay in sync after version bumps.
 */

const { execFileSync } = require('child_process');
const path = require('path');

// Semver pattern (strict)
const SEMVER_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.+-]+)?$/;

// Read version from package.json
const pkg = require('../package.json');
const version = pkg.version;

// Validate version format to prevent injection
if (!SEMVER_PATTERN.test(version)) {
  console.error(`Invalid version format: ${version}`);
  console.error('Version must match semver pattern (e.g., 1.0.0 or 1.0.0-beta.1)');
  process.exit(1);
}

// Path to info.plist (relative to project root)
const plistPath = path.join(__dirname, '..', 'info.plist');

// Update info.plist using PlistBuddy (execFileSync avoids shell interpolation)
try {
  execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :version ${version}`, plistPath], {
    stdio: 'inherit'
  });
  console.log(`Synced version ${version} to info.plist`);
} catch (error) {
  console.error('Failed to sync version to info.plist:', error.message);
  process.exit(1);
}
