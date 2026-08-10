# StreamDeck Mobile

**Turn your Android phone into a Stream Deck.**

StreamDeck Mobile is a React Native app + desktop daemon that integrates with [OpenDeck](https://github.com/nekename/OpenDeck) to give you a fully functional virtual Stream Deck — no hardware required (Linux). Also works as a companion configurator for physical Stream Decks on all platforms.

## Platform Support

| Feature | Linux | Windows | macOS |
|---|---|---|---|
| Mobile app (Expo/Android) | ✅ | ✅ | ✅ |
| Bridge plugin (action config) | ✅ | ✅ | ✅ |
| Virtual device daemon (uhid) | ✅ | ❌ | ❌ |
| Physical Stream Deck | ✅ | ✅ | ✅ |

> **Windows/macOS users**: The plugin and mobile app work fully as a Stream Deck companion. For virtual device emulation, use [Tacto](https://tacto.live/) or connect a physical Stream Deck.

## How It Works

```
┌──────────────┐   WS:58124   ┌──────────────┐   uhid/HID   ┌──────────────┐
│  Mobile App  │ ◄───────────► │   Daemon     │ ◄──────────► │   OpenDeck   │
│  (Virtual    │   images +   │  (Rust)      │   virtual    │  (Desktop)   │
│   Deck)      │    taps      │              │   MK.2 5x3   │              │
└──────────────┘              └──────────────┘              └──────────────┘
                                     │
       ┌─────────────────────────────┤
       │                             │
┌──────▼──────┐              ┌──────▼──────┐   WS:58123
│  Stream Deck │              │   Plugin    │ ◄──────► Mobile App
│  (physical)  │              │  (Node.js)  │   action config
└──────────────┘              └─────────────┘
```

1. **Daemon** (`daemon/`) creates a virtual Stream Deck MK.2 via Linux uhid — OpenDeck detects it as real hardware.
2. **Plugin** (`plugin/`) provides configurable actions (Custom Button, URL Opener, etc.) and live profile mirroring.
3. **Mobile app** shows button images from the virtual/physical deck and sends taps back. Also configures action states and appearance.

## Features

- **Virtual Stream Deck (Linux)** — No hardware needed. The Rust daemon emulates a Stream Deck MK.2 via uhid. OpenDeck detects it as a real device.
- **Physical Stream Deck (all OS)** — Use with a real Elgato Stream Deck for action configuration and live preview.
- **Action Library** — Custom Button (dual-state toggle), URL Opener, Hotkey, Text Sender, Multi Button (2×1 / 2×2)
- **Live Preview** — Real-time mirror of your Stream Deck buttons with event logging
- **State Editor** — Configure per-state colors, titles, and fonts. Dual-state toggle support.
- **Dark UI** — Designed to match OpenDeck's aesthetic

## Project Structure

```
streamdeck-app/
├── daemon/                           # Virtual Stream Deck daemon (Rust, Linux-only)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                    # Entry point, HID poll loop
│       ├── uhid.rs                    # uhid device emulation (VID 0x0FD9, PID 0x0080)
│       └── bridge.rs                  # WebSocket server (port 58124) for mobile app
├── mobile/                           # React Native (Expo) app
│   ├── App.tsx                       # Entry point with navigation
│   ├── app.json                      # Expo config
│   ├── eas.json                      # EAS Build config (cloud APK builds)
│   └── src/
│       ├── screens/                  # Connection, LivePreview, VirtualDeck, ButtonEditor
│       ├── components/               # StreamDeckGrid, StreamDeckButton
│       └── services/                 # OpenDeckBridge (REST + WebSocket client)
├── plugin/                           # OpenDeck plugin (Node.js / TypeScript)
│   └── com.streamdeckapp.mobile.sdPlugin/
│       ├── manifest.json             # OpenAction plugin manifest
│       ├── src/index.ts              # Plugin entry — WebSocket to OpenDeck
│       ├── src/server.ts             # HTTP + WS server (port 58123) for mobile app
│       └── pi/                       # Property inspectors (HTML)
├── shared/                           # Shared TypeScript types and constants
│   └── protocol.ts
└── .github/
    └── workflows/build-apk.yml       # CI/CD — builds APK via EAS Build
```

## Getting Started

### Prerequisites

- **Desktop**: [OpenDeck](https://github.com/nekename/OpenDeck/releases) installed
- **Desktop**: Node.js 20+ installed system-wide (required for Node.js plugins)
- **Mobile**: Android device or emulator
- **Development**: Node.js 22+, npm 11+

### 1. Install the Plugin

**Prerequisite: Node.js 20+** must be installed on the desktop running OpenDeck.

```bash
# Using nvm (recommended)
nvm install 22
nvm use 22
nvm alias default 22
```

> **nvm users**: Make sure `nvm alias default 22` is set so OpenDeck can find `node`.
> Verify with `node --version` in a **new terminal** before starting OpenDeck.
>
> If OpenDeck can't find `node` (launched from desktop icon), create a symlink:
> ```bash
> sudo ln -s "$(which node)" /usr/local/bin/node
> ```

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

### Troubleshooting Connection

**Check if the plugin server is running:**

Open your phone's browser and navigate to `http://<desktop-ip>:58123/ping`. You should see `{"pong":true}`. If not, the plugin server isn't running.

**Find your desktop IP:**

```bash
ip addr show | grep 'inet ' | grep -v 127.0.0.1
# or
hostname -I
```

**Check OpenDeck logs:**

```bash
# Linux
cat ~/.local/share/opendeck/logs/*.log | grep StreamDeckMobile

# You should see lines like:
# [StreamDeckMobile] Plugin started (PID 12345)
# [StreamDeckMobile] HTTP+WS server listening on port 58123
# [StreamDeckMobile] Reachable at: http://192.168.1.100:58123
```

**Common issues:**

- **Wrong IP**: Make sure you're using your desktop's LAN IP (usually `192.168.x.x` or `10.x.x.x`), not `127.0.0.1`.
- **Firewall**: Allow port `58123` through your firewall: `sudo ufw allow 58123/tcp`.
- **Different networks**: Phone and desktop must be on the same Wi-Fi/LAN.
- **Node.js not found by OpenDeck**: Ensure `node --version` works from any terminal. If using nvm, run `sudo ln -s "$(which node)" /usr/local/bin/node`.

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
