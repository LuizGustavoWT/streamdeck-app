.PHONY: all plugin-build plugin-zip plugin-deps plugin-clean mobile-start dev help

PLUGIN_DIR  := plugin/com.streamdeckapp.mobile.sdPlugin
PLUGIN_NAME := com.streamdeckapp.mobile.sdPlugin
PLUGIN_ZIP  := $(PLUGIN_NAME).zip

# Auto-detect OpenDeck plugins directory (Flatpak vs native)
OPENDECK_CONFIG := $(shell find $(HOME)/.var/app/me.amankhanna.opendeck/config/opendeck -maxdepth 0 -type d 2>/dev/null)
ifneq ($(OPENDECK_CONFIG),)
  PLUGINS_DIR := $(HOME)/.var/app/me.amankhanna.opendeck/config/opendeck/plugins
  OPENDECK_TYPE := flatpak
else
  PLUGINS_DIR := $(HOME)/.local/share/opendeck/plugins
  OPENDECK_TYPE := native
endif

all: plugin-build plugin-deps plugin-zip

# ─── Plugin: Build ──────────────────────────────────────────────────────────────

plugin-build:
	cd $(PLUGIN_DIR) && npm install --silent && npx tsc
	@echo "[OK] Plugin built to $(PLUGIN_DIR)/dist/"

# ─── Plugin: Production dependencies ────────────────────────────────────────────
# npm workspaces hoists deps to root — copy only runtime deps (ws) into plugin dir.
# Dev deps (typescript, tsx, @types) are not needed at runtime.

plugin-deps:
	@rm -rf $(PLUGIN_DIR)/node_modules
	@mkdir -p $(PLUGIN_DIR)/node_modules
	@if [ -d node_modules/ws ]; then \
		cp -r node_modules/ws $(PLUGIN_DIR)/node_modules/ws; \
		echo "[OK] Bundled ws (runtime only)"; \
	else \
		echo "[ERROR] ws not found — run 'npm install' at project root first"; \
		exit 1; \
	fi

# ─── Plugin: Zip ────────────────────────────────────────────────────────────────
# Zips from plugin/ so the .sdPlugin folder is preserved inside the archive.
# OpenDeck expects: <name>.sdPlugin/manifest.json at the root of the extracted folder.

plugin-zip: plugin-build plugin-deps
	cd plugin && zip -r ../$(PLUGIN_ZIP) $(PLUGIN_NAME) \
		-x "$(PLUGIN_NAME)/src/*" \
		-x "$(PLUGIN_NAME)/tsconfig.json" \
		-x "$(PLUGIN_NAME)/dist/*.d.ts" \
		-x "$(PLUGIN_NAME)/dist/*.map" \
		-x "$(PLUGIN_NAME)/node_modules/.package-lock.json" \
		-x "*.tsbuildinfo"
	@echo "[OK] Plugin archive: $(PLUGIN_ZIP)"
	@echo ""
	@echo "Install manually:"
	@echo "  unzip $(PLUGIN_ZIP) -d $(PLUGINS_DIR)"
	@echo ""
	@echo "or run: make dev"

# ─── Plugin: Clean ──────────────────────────────────────────────────────────────

plugin-clean:
	rm -rf $(PLUGIN_DIR)/dist
	rm -rf $(PLUGIN_DIR)/node_modules
	rm -f $(PLUGIN_ZIP)
	@echo "[OK] Cleaned"

# ─── Mobile ────────────────────────────────────────────────────────────────────

mobile-start:
	cd mobile && npx expo start --port 8082

# ─── Dev: rebuild plugin + deploy + start app ────────────────────────────────────

dev: plugin-zip
	@echo ""
	@echo "OpenDeck: $(OPENDECK_TYPE) → $(PLUGINS_DIR)"
	@mkdir -p "$(PLUGINS_DIR)"
	@rm -rf "$(PLUGINS_DIR)/$(PLUGIN_NAME)"
	@unzip -qo $(PLUGIN_ZIP) -d "$(PLUGINS_DIR)"
	@echo "[OK] Plugin deployed to $(PLUGINS_DIR)"
	@echo "       Restart OpenDeck to reload the plugin"
	@echo ""
	@echo ""
	@echo "Starting Expo..."
	cd mobile && npx expo start --port 8082

# ─── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo "StreamDeck Mobile — Makefile"
	@echo ""
	@echo "  make dev            Build plugin + deploy to OpenDeck + start Expo"
	@echo "  make plugin-build   Build plugin (TypeScript -> JavaScript)"
	@echo "  make plugin-deps    Copy production deps into plugin dir"
	@echo "  make plugin-zip     Build + bundle deps + create .zip"
	@echo "  make plugin-clean   Remove dist/, node_modules/, .zip"
	@echo "  make mobile-start   Start Expo dev server"
	@echo "  make                Build plugin + deps + zip"
