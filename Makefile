.PHONY: all plugin-build plugin-zip plugin-clean mobile-start help

PLUGIN_DIR := plugin/com.streamdeckapp.mobile.sdPlugin
PLUGIN_SRC := $(PLUGIN_DIR)/src
PLUGIN_DIST := $(PLUGIN_DIR)/dist
PLUGIN_NAME := com.streamdeckapp.mobile.sdPlugin
PLUGIN_ZIP := $(PLUGIN_NAME).zip
MOBILE_DIR := mobile

# ─── Default ───────────────────────────────────────────────────────────────────

all: plugin-build plugin-zip

# ─── Plugin ────────────────────────────────────────────────────────────────────

plugin-install:
	@echo "📦 Installing plugin dependencies..."
	cd $(PLUGIN_DIR) && npm install

plugin-build: plugin-install
	@echo "🔨 Building plugin (TypeScript → JavaScript)..."
	cd $(PLUGIN_DIR) && npx tsc
	@echo "✅ Plugin built to $(PLUGIN_DIST)/"

plugin-zip: plugin-build
	@echo "📦 Creating plugin archive..."
	cd $(PLUGIN_DIR) && \
		zip -r ../../$(PLUGIN_ZIP) \
			manifest.json \
			dist/ \
			pi/ \
			assets/ \
			-x "*.tsbuildinfo" "*.map" 2>/dev/null || \
		zip -r ../../$(PLUGIN_ZIP) \
			manifest.json \
			dist/ \
			pi/ \
			assets/
	@echo "✅ Plugin archive: $(PLUGIN_ZIP)"

plugin-clean:
	@echo "🧹 Cleaning plugin build..."
	rm -rf $(PLUGIN_DIST)
	rm -f $(PLUGIN_ZIP)
	@echo "✅ Cleaned"

# ─── Mobile ────────────────────────────────────────────────────────────────────

mobile-install:
	@echo "📦 Installing mobile dependencies..."
	cd $(MOBILE_DIR) && npm install

mobile-start: mobile-install
	@echo "🚀 Starting Expo dev server..."
	cd $(MOBILE_DIR) && npx expo start --port 8082

# ─── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo "StreamDeck Mobile — Makefile"
	@echo ""
	@echo "Plugin:"
	@echo "  make plugin-build    Build plugin (TS → JS)"
	@echo "  make plugin-zip      Build + create .zip for OpenDeck"
	@echo "  make plugin-clean    Remove dist/ and .zip"
	@echo ""
	@echo "Mobile:"
	@echo "  make mobile-start    Install deps + start Expo dev server"
	@echo ""
	@echo "All:"
	@echo "  make                 Build plugin + zip"
