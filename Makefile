.PHONY: all plugin-build plugin-zip plugin-deps plugin-clean mobile-start dev kill help

PLUGIN_DIR  := plugin/com.streamdeckapp.mobile.sdPlugin
PLUGIN_NAME := com.streamdeckapp.mobile.sdPlugin
PLUGIN_ZIP  := $(PLUGIN_NAME).zip

OPENDECK_CONFIG := $(shell find $(HOME)/.var/app/me.amankhanna.opendeck/config/opendeck -maxdepth 0 -type d 2>/dev/null)
ifneq ($(OPENDECK_CONFIG),)
  PLUGINS_DIR := $(HOME)/.var/app/me.amankhanna.opendeck/config/opendeck/plugins
  OPENDECK_TYPE := flatpak
else
  PLUGINS_DIR := $(HOME)/.local/share/opendeck/plugins
  OPENDECK_TYPE := native
endif

all: plugin-build plugin-deps plugin-zip

# ─── Plugin ────────────────────────────────────────────────────────────────────

plugin-build:
	cd $(PLUGIN_DIR) && npm install --silent && npx tsc
	@echo "[OK] Plugin built to $(PLUGIN_DIR)/dist/"

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

plugin-zip: plugin-build plugin-deps
	cd plugin && zip -r ../$(PLUGIN_ZIP) $(PLUGIN_NAME) \
		-x "$(PLUGIN_NAME)/src/*" \
		-x "$(PLUGIN_NAME)/tsconfig.json" \
		-x "$(PLUGIN_NAME)/dist/*.d.ts" \
		-x "$(PLUGIN_NAME)/dist/*.map" \
		-x "$(PLUGIN_NAME)/node_modules/.package-lock.json" \
		-x "*.tsbuildinfo"
	@echo "[OK] $(PLUGIN_ZIP)"

plugin-clean:
	rm -rf $(PLUGIN_DIR)/dist
	rm -rf $(PLUGIN_DIR)/node_modules
	rm -f $(PLUGIN_ZIP)
	@echo "[OK] Cleaned"

# ─── Kill ──────────────────────────────────────────────────────────────────────

kill:
	@kill $$(lsof -ti:58123) 2>/dev/null && echo "[OK] Killed old plugin on 58123" || true

# ─── Dev ───────────────────────────────────────────────────────────────────────

dev: kill plugin-zip
	@echo ""
	@echo "OpenDeck: $(OPENDECK_TYPE) → $(PLUGINS_DIR)"
	@mkdir -p "$(PLUGINS_DIR)"
	@rm -rf "$(PLUGINS_DIR)/$(PLUGIN_NAME)"
	@unzip -qo $(PLUGIN_ZIP) -d "$(PLUGINS_DIR)"
	@echo "[OK] Plugin deployed — restart OpenDeck/Tacto to reload"
	@echo ""
	@echo "Starting Expo..."
	cd mobile && npx expo start --port 8082

# ─── Mobile ────────────────────────────────────────────────────────────────────

mobile-start:
	cd mobile && npx expo start --port 8082

# ─── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo "StreamDeck Mobile — Makefile"
	@echo ""
	@echo "  make dev            Build plugin + deploy + start Expo"
	@echo "  make kill           Kill lingering plugin on port 58123"
	@echo "  make plugin-build   Build plugin (TypeScript -> JavaScript)"
	@echo "  make plugin-zip     Build + bundle deps + create .zip"
	@echo "  make plugin-clean   Remove dist/, node_modules/, .zip"
	@echo "  make mobile-start   Start Expo dev server"
	@echo "  make                Build plugin + deps + zip"
