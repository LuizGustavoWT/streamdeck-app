# StreamDeck Mobile

**Control your Elgato Stream Deck from your Android phone.**

StreamDeck Mobile is a React Native app that integrates with [OpenDeck](https://github.com/nekename/OpenDeck) — the open-source desktop application for Stream Deck devices — to let you design, preview, and control your Stream Deck layouts right from your phone.

## How It Works

```
┌──────────────┐     HTTP/WebSocket     ┌─────────────────┐     OpenAction API     ┌──────────────┐
│  Mobile App  │ ◄────────────────────► │  Bridge Plugin  │ ◄─────────────────────► │   OpenDeck   │
│  (Android)   │                        │  (Node.js)      │                        │  (Desktop)   │
└──────────────┘                        └─────────────────┘                        └──────┬───────┘
                                                                                         │
                                                                                  ┌──────▼───────┐
                                                                                  │ Stream Deck  │
                                                                                  │   Hardware   │
                                                                                  └──────────────┘
```

1. **OpenDeck** runs on your desktop and connects to your Stream Deck hardware.
2. **The bridge plugin** (`plugin/`) loads into OpenDeck and starts an HTTP + WebSocket server on your local network.
3. **The mobile app** connects to the plugin, letting you design button layouts, assign actions, and push them to the Stream Deck. It also mirrors the deck's state in real time.

## Features

- **Visual Layout Designer** — Drag-style grid editor matching your Stream Deck dimensions (Mini, MK.2, XL, Neo)
- **Action Library** — Custom Button, URL Opener, Hotkey, and Text Sender actions
- **Live Preview** — Real-time mirror of what's on your Stream Deck with event logging
- **Push to Deck** — Send your layout directly to OpenDeck with one tap
- **Dark UI** — Designed to match OpenDeck's aesthetic

## Project Structure

```
streamdeck-app/
├── mobile/                          # React Native (Expo) app
│   ├── App.tsx                      # Entry point with navigation
│   ├── app.json                     # Expo config
│   ├── eas.json                     # EAS Build config (cloud APK builds)
│   └── src/
│       ├── screens/                 # ConnectionScreen, LayoutDesigner, etc.
│       ├── components/              # StreamDeckGrid, StreamDeckButton, ActionCard
│       ├── services/                # OpenDeckBridge (REST + WebSocket client)
│       └── hooks/                   # useBridge, useLayout
├── plugin/                          # OpenDeck plugin (Node.js / TypeScript)
│   └── com.streamdeckapp.mobile.sdPlugin/
│       ├── manifest.json            # OpenAction plugin manifest
│       ├── src/index.ts             # Plugin entry — WebSocket to OpenDeck
│       ├── src/server.ts            # HTTP + WS server for mobile app
│       └── pi/                      # Property inspectors (HTML)
├── shared/                          # Shared TypeScript types and constants
│   └── protocol.ts
└── .github/
    └── workflows/build-apk.yml      # CI/CD — builds APK via EAS Build
```

## Getting Started

### Prerequisites

- **Desktop**: [OpenDeck](https://github.com/nekename/OpenDeck/releases) installed
- **Mobile**: Android device or emulator
- **Development**: Node.js 22+, npm 11+

### 1. Install the Plugin

Copy the plugin into OpenDeck's plugins directory:

```bash
# Linux
cp -r plugin/com.streamdeckapp.mobile.sdPlugin ~/.local/share/opendeck/plugins/

# Windows (PowerShell)
Copy-Item -Recurse plugin/com.streamdeckapp.mobile.sdPlugin $env:APPDATA/opendeck/plugins/

# macOS
cp -r plugin/com.streamdeckapp.mobile.sdPlugin ~/Library/Application Support/opendeck/plugins/
```

Build the plugin (TypeScript → JavaScript):

```bash
cd plugin/com.streamdeckapp.mobile.sdPlugin
npm install
npm run build
```

Restart OpenDeck. You should see "StreamDeck Mobile" in the Plugins tab.

### 2. Run the Mobile App

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or press `a` for Android emulator.

### 3. Connect

1. Find your desktop's local IP address (e.g., `192.168.1.100`).
2. In the app, enter the IP and port `58123`.
3. Tap **Connect**.
4. Start designing your layout!

## Building the APK

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) for cloud APK builds.

### One-time setup

```bash
cd mobile
npx eas login
npx eas build:configure
```

### Build

```bash
# Preview APK (for testing)
npx eas build --platform android --profile preview

# Production AAB (for Play Store)
npx eas build --platform android --profile production
```

### GitHub Actions

Push to `main` or manually trigger the **Build APK (EAS)** workflow. Requires the `EXPO_TOKEN` secret set in your repository settings.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native (Expo SDK 52), TypeScript |
| Navigation | React Navigation v7 (native stack) |
| Plugin | Node.js, TypeScript, WebSocket (`ws`) |
| API Protocol | OpenAction API (Stream Deck SDK compatible) |
| CI/CD | GitHub Actions + Expo EAS Build |
| Desktop Host | [OpenDeck](https://github.com/nekename/OpenDeck) (Tauri + Rust + SvelteKit) |

## License

This project is licensed under the **GNU General Public License v3.0** — see [LICENSE](./LICENSE) for details.

OpenDeck is also GPL-3.0 licensed.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](./SECURITY.md) for our security policy and reporting procedures.
