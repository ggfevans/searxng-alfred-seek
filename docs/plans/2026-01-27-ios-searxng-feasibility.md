# iOS SearXNG Integration - Feasibility Analysis

**Date:** 2026-01-27
**Status:** Research complete, implementation not started
**Target Platform:** iOS 26.2+

## Overview

This document analyzes the technical feasibility of creating iOS integration for personal SearXNG instances, covering Safari extensions, Share extensions, standalone apps, and Spotlight/App Shortcuts.

## Security Context

The target deployment assumes:
- SearXNG instance accessible via **Tailscale** (private tailnet, WireGuard encrypted)
- **DNS over HTTPS** for query privacy
- Self-hosted infrastructure (not public SearXNG instances)

## Approach Comparison

| Approach | Feasibility | Privacy | UX Friction | Complexity |
|----------|-------------|---------|-------------|------------|
| Safari Web Extension | Yes | Good* | Lowest | Medium |
| Share Extension | Yes | Excellent | Medium | Low |
| Standalone App | Yes | Excellent | Highest | Low-Medium |
| App Shortcuts/Spotlight | Yes | Excellent | Medium | Low |

*Requires DNS blocking mitigation (see below)

## 1. Safari Web Extension (Search Redirect)

### How It Works

Safari Web Extensions intercept searches in the address bar and redirect them to a custom search engine using:

1. **`declarativeNetRequest`** - Block/redirect network requests via JSON rules
2. **`webNavigation.onBeforeNavigate`** + **`tabs.update()`** - Detect navigation and redirect

### Project Structure

```
iOS App/
├── MyApp.swift                     # Container app (required for App Store)
├── SettingsView.swift              # Configure SearXNG URL
└── Resources/
Extension/
├── manifest.json                   # Permissions, scripts
├── background.js                   # Redirect logic
├── popup.html + popup.js           # Settings UI
├── rules.json                      # DNR rules
└── SafariWebExtensionHandler.swift # Native ↔ JS bridge
```

### Key Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "SearXNG Search",
  "permissions": [
    "declarativeNetRequest",
    "declarativeNetRequestWithHostAccess",
    "webNavigation",
    "tabs",
    "storage"
  ],
  "host_permissions": [
    "*://www.google.com/*",
    "*://duckduckgo.com/*",
    "*://www.bing.com/*",
    "*://search.yahoo.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "declarative_net_request": {
    "rule_resources": [{
      "id": "ruleset",
      "enabled": true,
      "path": "rules.json"
    }]
  }
}
```

### Privacy Concern & Mitigation

**The Problem:** Safari sends the search query to the default search engine *before* the extension redirects it. Your query briefly leaks to Google/Bing.

**Mitigation for Tailscale Setup:**
1. Set Safari's default search engine to one you don't use (Ecosia)
2. Use Tailscale MagicDNS or Pi-hole to block that engine's domains
3. Query never reaches the "default" engine → extension redirects cleanly to SearXNG

### iOS-Specific Limitations

- `browser.webRequest` API not supported on iOS (requires persistent background pages)
- `regexSubstitution` redirects can have edge-case issues
- Extension must be distributed within an iOS app (App Store or TestFlight)

### Existing Examples

- [Custom-Search](https://github.com/mhaeuser/Custom-Search) - Works on iOS, open source
- [Customize Search Engine](https://apps.apple.com/us/app/customize-search-engine/id6445840140) - App Store

### References

- [How Safari search engine extensions work](https://lapcatsoftware.com/articles/2025/2/2.html)
- [Apple Developer: Safari Web Extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
- [WWDC23: What's new in Safari extensions](https://developer.apple.com/videos/play/wwdc2023/10119/)

---

## 2. Share Sheet Extension

### How It Works

A Share Extension appears in the iOS share sheet when users select text or share URLs. It receives the shared content and opens SearXNG with that content as a search query.

### Project Structure

```
iOS App/
├── MyApp.swift                    # Main app with settings
├── ContentView.swift
├── Shared/
│   └── AppGroup.swift             # Shared settings container
ShareExtension/
├── ShareViewController.swift      # Receives shared content
├── ShareView.swift                # Optional SwiftUI UI
└── Info.plist                     # Activation rules
```

### Info.plist Activation Rules

```xml
<key>NSExtensionActivationRule</key>
<dict>
    <key>NSExtensionActivationSupportsText</key>
    <true/>
    <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
    <integer>1</integer>
</dict>
```

### Core Implementation

```swift
class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachment = item.attachments?.first else {
            close()
            return
        }

        if attachment.hasItemConformingToTypeIdentifier("public.plain-text") {
            attachment.loadItem(forTypeIdentifier: "public.plain-text") { [weak self] text, _ in
                if let query = text as? String {
                    self?.searchSearXNG(query: query)
                }
            }
        } else if attachment.hasItemConformingToTypeIdentifier("public.url") {
            attachment.loadItem(forTypeIdentifier: "public.url") { [weak self] url, _ in
                if let url = url as? URL {
                    self?.searchSearXNG(query: url.absoluteString)
                }
            }
        }
    }

    func searchSearXNG(query: String) {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let searxngURL = "https://search.your-tailnet.ts.net/search?q=\(encoded)"

        // Open via custom URL scheme → main app → Safari
        if let url = URL(string: "myapp://search?q=\(encoded)") {
            extensionContext?.open(url)
        }
        close()
    }

    func close() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
```

### Advantages

- No privacy leak (user explicitly triggers)
- Works from any app (Safari, Notes, Messages, etc.)
- Simple, well-documented iOS APIs
- App Groups enable shared settings

### Limitations

- Requires 2 taps (Share → select extension)
- Cannot intercept Safari address bar searches
- Extensions cannot directly open URLs (must use URL scheme to main app)

### References

- [iOS Share Extension with SwiftUI and SwiftData](https://www.merrell.dev/ios-share-extension-with-swiftui-and-swiftdata/)
- [Apple: App Extension Programming Guide](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html)

---

## 3. Standalone iOS App

### How It Works

A dedicated app with an embedded browser (WKWebView or iOS 26's native WebView) pointed at your SearXNG instance.

### Architecture Options

| Approach | iOS Version | Complexity | Notes |
|----------|-------------|------------|-------|
| WKWebView + UIViewRepresentable | iOS 14+ | Medium | Current standard |
| Native WebView/WebPage | iOS 26+ | Low | New SwiftUI-native |
| SFSafariViewController | iOS 14+ | Very Low | Safari UI, limited customization |

### iOS 26 Native WebView (Recommended)

```swift
import WebKit
import SwiftUI

struct SearXNGView: View {
    @State private var page = WebPage()
    @State private var query = ""
    @AppStorage("searxng_url") private var baseURL = "https://search.your-tailnet.ts.net"

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("Search", text: $query)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { performSearch() }

                Button("Search") { performSearch() }
            }
            .padding()

            WebView(page)
        }
        .onAppear {
            page.load(URLRequest(url: URL(string: baseURL)!))
        }
    }

    func performSearch() {
        guard !query.isEmpty,
              let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(baseURL)/search?q=\(encoded)") else { return }
        page.load(URLRequest(url: url))
    }
}
```

### Potential Features

- Configurable SearXNG instance URL
- Bang modifier support (like Alfred workflow: `!i` for images, `!d` for day)
- Local search history (privacy-respecting)
- Multiple instances/profiles
- Home screen widgets for quick search
- Shortcuts integration for Siri

### Advantages

- Full control over UX
- Can add features beyond SearXNG web UI
- No privacy concerns
- Can bundle Share Extension in same app

### Limitations

- Users must open the app explicitly
- Requires App Store distribution or TestFlight

### References

- [WWDC25: WebKit for SwiftUI](https://dev.to/arshtechpro/wwdc-2025-webkit-for-swiftui-2igc)
- [Exploring WebView and WebPage in SwiftUI for iOS 26](https://www.appcoda.com/swiftui-webview/)
- [Apple: WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)

---

## 4. App Shortcuts / Spotlight Integration

### How It Works

App Intents (iOS 16+) expose actions that appear in Spotlight and can be triggered by Siri. In iOS 26, actions can run directly from Spotlight without opening the app.

**Note:** This is NOT a Spotlight search provider replacement. Users must type a phrase like "Search SearXNG for..." to trigger the shortcut.

### Implementation

```swift
import AppIntents

struct SearchSearXNGIntent: AppIntent {
    static var title: LocalizedStringResource = "Search SearXNG"
    static var description = IntentDescription("Search your SearXNG instance")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Query", requestValueDialog: "What do you want to search?")
    var query: String

    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let url = URL(string: "https://search.your-tailnet.ts.net/search?q=\(encoded)")!
        return .result(opensIntent: OpenURLIntent(url))
    }
}

struct SearXNGShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SearchSearXNGIntent(),
            phrases: [
                "Search SearXNG for \(\.$query)",
                "SearXNG \(\.$query)",
                "Search my server for \(\.$query)"
            ],
            shortTitle: "Search SearXNG",
            systemImageName: "magnifyingglass"
        )
    }
}
```

### User Experience

1. Pull down Spotlight
2. Type "Search SearXNG for best tacos"
3. Shortcut appears in results
4. Tap → opens SearXNG with query

Or via Siri: "Hey Siri, search SearXNG for best tacos"

### Advantages

- Works from Spotlight and Siri
- Excellent privacy (direct to SearXNG)
- Can run in background (iOS 26) or open app
- Integrates with Shortcuts automations

### Limitations

- Not a default search replacement
- Requires specific phrase/app name
- Users must discover the shortcut exists

### References

- [WWDC25: Develop for Shortcuts and Spotlight with App Intents](https://developer.apple.com/videos/play/wwdc2025/260/)
- [Apple: App Shortcuts](https://developer.apple.com/documentation/appintents/app-shortcuts)
- [App Intents Spotlight integration](https://www.avanderlee.com/swiftui/app-intents-spotlight-integration-using-shortcuts/)

---

## Recommended Implementation

For a Tailscale-based personal setup, implement a single iOS app containing:

### Phase 1: Core App
1. **Standalone App** with native WebView (iOS 26)
2. **Share Extension** for searching from any app
3. **App Shortcuts** for Siri/Spotlight access

### Phase 2: Safari Integration (Optional)
4. **Safari Web Extension** with DNS blocking mitigation

### App Structure

```
SearXNG-iOS/
├── SearXNG/
│   ├── SearXNGApp.swift
│   ├── Views/
│   │   ├── SearchView.swift         # Main WebView interface
│   │   └── SettingsView.swift       # Instance URL, preferences
│   ├── Intents/
│   │   ├── SearchIntent.swift       # App Shortcuts
│   │   └── ShortcutsProvider.swift
│   └── Shared/
│       └── AppGroup.swift           # Shared settings
├── ShareExtension/
│   ├── ShareViewController.swift
│   └── Info.plist
├── SafariExtension/                 # Phase 2
│   ├── manifest.json
│   ├── background.js
│   └── SafariWebExtensionHandler.swift
└── Tests/
```

---

## Open Questions

1. **App Store vs TestFlight only?** Safari extensions require App Store review, but personal-use apps can stay on TestFlight indefinitely.

2. **Bang modifier support?** Port the Alfred workflow's bang parsing (`!i`, `!n`, `!d`, `!m`, `!y`) to iOS?

3. **Widget priority?** Home screen widget for quick search entry?

4. **Multiple instances?** Support for multiple SearXNG servers (work/personal)?

---

## Next Steps

1. Create new Xcode project with iOS 26 deployment target
2. Implement standalone app with WebView
3. Add Share Extension
4. Add App Shortcuts
5. (Optional) Add Safari Web Extension with DNS blocking setup guide
