# Contributing to StreamDeck Mobile

Thanks for your interest in contributing! This document outlines the process and guidelines.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## How to Contribute

### Reporting Bugs

1. Check the [existing issues](https://github.com/LuizGustavoWT/streamdeck-app/issues) to avoid duplicates.
2. Open a new issue using the **Bug Report** template.
3. Include:
   - Device model and OS version
   - OpenDeck version
   - Steps to reproduce
   - Expected vs actual behavior
   - Logs (if available)

### Suggesting Features

1. Check [existing issues](https://github.com/LuizGustavoWT/streamdeck-app/issues) and [discussions](https://github.com/LuizGustavoWT/streamdeck-app/discussions).
2. Open a **Feature Request** issue.
3. Describe the use case and how it benefits Stream Deck users.

### Pull Requests

1. **Fork** the repository.
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes. Follow the coding standards below.
4. Ensure your code builds and passes checks.
5. Write or update tests if applicable.
6. Update documentation if your changes affect the API or user-facing behavior.
7. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add multi-device layout switching
   fix: resolve WebSocket reconnect on network change
   docs: update plugin installation guide
   ```
8. Push and open a Pull Request against `main`.
9. Link any related issues.

### PR Review Process

- All PRs require at least **one review** from a maintainer.
- CI checks must pass (linting, type checking).
- PRs should be focused — one feature or fix per PR.
- Breaking changes must be clearly documented.

## Development Setup

### Prerequisites

- Node.js 22+
- npm 11+
- Expo CLI (`npm install -g expo-cli` or use `npx`)
- OpenDeck installed on your desktop (for integration testing)

### Project Setup

```bash
git clone https://github.com/LuizGustavoWT/streamdeck-app.git
cd streamdeck-app

# Plugin
cd plugin/com.streamdeckapp.mobile.sdPlugin
npm install
npm run build

# Mobile app
cd ../../mobile
npm install
npx expo start
```

### Running the Plugin (Standalone Dev)

```bash
cd plugin/com.streamdeckapp.mobile.sdPlugin
npm run dev
# Starts the HTTP+WS server on port 58123 without OpenDeck
```

## Coding Standards

### TypeScript

- **Strict mode** is enabled in all `tsconfig.json` files.
- No `any` types — use `unknown` and narrow appropriately.
- Exhaustive type checking on all API boundaries.
- Prefer `interface` over `type` for object shapes (except unions).

### React Native

- Functional components with hooks only.
- One component per file (except small private helpers).
- Use `StyleSheet.create` for all styles.
- Navigation params must be typed via `RootStackParamList`.

### Plugin (Node.js)

- ESM modules only (`"type": "module"`).
- Async/await over raw promises.
- Proper error handling — no silent failures.
- Log all significant events with `[StreamDeckMobile]` prefix.

### General

- Run `npm run build` in the plugin directory before committing TypeScript changes.
- Ensure no TypeScript errors: `npx tsc --noEmit` in both `mobile/` and `plugin/`.
- Format code consistently (we use Prettier defaults).

## Project Architecture

For architecture decisions, see the README and source code comments. Key principles:

1. **The plugin is the bridge** — It translates between the mobile app's REST/WebSocket protocol and OpenDeck's OpenAction WebSocket protocol.
2. **Shared protocol** — All message types are defined in `shared/protocol.ts` and must be kept in sync.
3. **No direct hardware access** — The mobile app never talks to the Stream Deck directly. All communication goes through OpenDeck.

## Getting Help

- **Questions?** Open a [GitHub Discussion](https://github.com/LuizGustavoWT/streamdeck-app/discussions).
- **Bug?** Open an [issue](https://github.com/LuizGustavoWT/streamdeck-app/issues).
- **Chat?** Join the [OpenDeck Discord](https://discord.gg/26Nf8rHvaj) — look for the `#plugin-dev` channel.
