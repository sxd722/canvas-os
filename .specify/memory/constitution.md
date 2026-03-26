<!--
=============================================================================
SYNC IMPACT REPORT
=============================================================================
Version change: N/A → 1.0.0 (initial constitution)

Modified principles: N/A (new constitution)

Added sections:
  - Core Principles (5 principles)
    - I. MV3 CSP Compliance
    - II. Local Build Pipeline
    - III. Remote Debugging Verification
    - IV. Component Architecture
    - V. Extension API Isolation
  - Technical Stack
  - Development Workflow
  - Governance

Removed sections: N/A

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (reviewed - Constitution Check compatible)
  - ✅ .specify/templates/spec-template.md (reviewed - requirements structure compatible)
  - ✅ .specify/templates/tasks-template.md (reviewed - phase structure compatible)
  - ✅ .opencode/command/*.md (reviewed - no agent-specific references)

Follow-up TODOs: None
=============================================================================
-->

# Canvas Coworker Constitution

## Core Principles

### I. MV3 CSP Compliance (NON-NEGOTIABLE)

All code MUST adhere to Manifest V3 Content Security Policy restrictions:

- **NO remote CDNs**: All assets, scripts, and styles MUST be bundled locally
- **NO inline scripts**: All JavaScript MUST be in separate files referenced by `src`
- **NO `eval()`**: No dynamic code evaluation in extension pages (background, popup, options)
- **NO `new Function()`**: Constructor forms of dynamic code execution are prohibited
- **CSP-compliant APIs only**: Use chrome.scripting.executeScript for content script injection

**Rationale**: Chrome Web Store enforces MV3 CSP. Violations will cause rejection or runtime errors.

### II. Local Build Pipeline

All frontend code MUST be built using the local Vite + React + Tailwind pipeline:

- **Vite**: Build tool for fast HMR and production bundling
- **React 18+**: UI component framework with concurrent features
- **Tailwind CSS**: Utility-first styling, processed at build time
- **TypeScript**: Type-safe development (recommended but not mandatory)
- **Output to `dist/`**: Extension loads from bundled output, not source

All dependencies MUST be declared in `package.json` and bundled. No runtime imports from external URLs.

**Rationale**: Ensures reproducible builds, offline capability, and CSP compliance.

### III. Remote Debugging Verification

All functional testing and self-verification MUST use Chrome Remote Debugging Protocol:

- **Connection**: `localhost:9222` via Chrome DevTools Protocol
- **Testing approach**: Programmatic browser automation for extension behavior
- **Required setup**: Chrome launched with `--remote-debugging-port=9222`
- **Verification scope**: Popup rendering, content script injection, background service worker

Manual UI inspection is supplementary. Automated verification via CDP is required for CI-ready tests.

**Rationale**: Enables consistent, reproducible testing without manual intervention.

### IV. Component Architecture

React components MUST follow a clear, maintainable structure:

- **Functional components**: Use hooks; avoid class components
- **Component isolation**: Each component in its own file
- **Props typing**: TypeScript interfaces or JSDoc for prop definitions
- **State locality**: Keep state as close to where it's used as possible
- **Side effects**: Use `useEffect` with explicit dependency arrays

Directory structure for extension pages:
```
src/
├── popup/        # Popup UI components
├── options/      # Options page components  
├── content/      # Content script modules
├── background/   # Service worker modules
└── shared/       # Shared components/utilities
```

**Rationale**: Improves code navigation, testing, and maintainability.

### V. Extension API Isolation

Chrome Extension APIs MUST be used correctly per MV3 guidelines:

- **Service Worker**: Background scripts run as service workers (no DOM access)
- **Message passing**: Use `chrome.runtime.sendMessage`/`onMessage` for cross-context communication
- **Storage**: Use `chrome.storage` API (not localStorage) for extension data
- **Permissions**: Request minimal permissions; use optional_permissions where possible
- **Content scripts**: Inject programmatically via `chrome.scripting` API (not manifest `content_scripts` for dynamic needs)

**Rationale**: Ensures compatibility with MV3 runtime and Chrome Web Store policies.

## Technical Stack

**Build System**:
- Node.js 18+ 
- Vite 5.x with React plugin
- Tailwind CSS 3.x with PostCSS
- TypeScript 5.x (recommended)

**Extension APIs**:
- chrome.runtime (messaging, lifecycle)
- chrome.storage (data persistence)
- chrome.scripting (content script injection)
- chrome.tabs (tab management)
- chrome.action (popup, badges)

**Testing**:
- Chrome DevTools Protocol (CDP) on localhost:9222
- Vitest or Jest for unit tests
- Puppeteer/Playwright for integration tests via CDP

## Development Workflow

**Build Commands**:
1. `npm install` - Install dependencies
2. `npm run dev` - Development build with HMR (load unpacked from `dist/`)
3. `npm run build` - Production build
4. `npm run test` - Run tests via CDP connection

**Testing Protocol**:
1. Launch Chrome: `chrome --remote-debugging-port=9222`
2. Load extension from `dist/` as unpacked
3. Run automated tests connecting to `localhost:9222`
4. Verify popup, content scripts, and background behavior

**Code Review Gates**:
- All code must pass `npm run build` without errors
- No external URLs in bundled output
- CSP compliance verified in manifest.json
- TypeScript strict mode passes (if using TypeScript)

## Governance

**Amendment Procedure**:
1. Propose changes via pull request to `.specify/memory/constitution.md`
2. Document rationale in PR description
3. Update version per semantic versioning
4. Run consistency checks against all templates
5. Merge after review approval

**Versioning Policy**:
- MAJOR: Principle removal or incompatible redefinition
- MINOR: New principle added or section expanded
- PATCH: Clarifications, typo fixes, non-semantic changes

**Compliance Review**:
- All PRs must reference which principles they adhere to
- Constitution supersedes undocumented practices
- When in doubt, escalate to architecture review

**Guidance File**: `.specify/memory/constitution.md` (this file)

**Version**: 1.0.0 | **Ratified**: 2026-03-24 | **Last Amended**: 2026-03-24
