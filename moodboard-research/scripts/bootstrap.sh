#!/usr/bin/env bash
# moodboard-research skill bootstrap
# Idempotent — safe to re-run.
# Installs Node deps, Python venv + deps, and Playwright Chromium.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILL_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "Moodboard-research bootstrap"
echo "Skill dir: $SKILL_DIR"
echo "----------------------------------------"

# ---- 1. Node check -----------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "[FAIL] Node.js not found in PATH."
  echo ""
  echo "Please install Node.js 18 or newer, then re-run this script."
  case "$(uname -s)" in
    Darwin)
      echo "  macOS options:"
      echo "    a) Official installer:  https://nodejs.org/   (recommended for non-developers)"
      echo "    b) Homebrew:            brew install node"
      echo "    c) nvm (advanced):      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
      ;;
    Linux)
      echo "  Linux: use your package manager, e.g."
      echo "    sudo apt-get install -y nodejs npm   (Debian/Ubuntu)"
      echo "    sudo dnf install -y nodejs npm       (Fedora)"
      ;;
    *)
      echo "  See https://nodejs.org/"
      ;;
  esac
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "[FAIL] Node $(node -v) is too old — need 18 or newer."
  exit 1
fi
echo "[OK]   Node $(node -v)"

# ---- 2. Python check ---------------------------------------------------------
PY=""
for cand in python3 python; do
  if command -v "$cand" >/dev/null 2>&1; then
    if "$cand" -c "import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)" 2>/dev/null; then
      PY="$cand"; break
    fi
  fi
done
if [ -z "$PY" ]; then
  echo "[FAIL] Python 3.9+ not found in PATH."
  echo ""
  echo "Please install Python 3.9+, then re-run this script."
  case "$(uname -s)" in
    Darwin)
      echo "  macOS: Python 3 ships with the system; if missing, install Command Line Tools:"
      echo "    xcode-select --install"
      echo "  Or download from https://www.python.org/downloads/"
      ;;
    Linux)
      echo "    sudo apt-get install -y python3 python3-venv python3-pip"
      ;;
  esac
  exit 1
fi
echo "[OK]   $($PY --version) at $(command -v $PY)"

# ---- 3. Python venv ----------------------------------------------------------
VENV="$SKILL_DIR/.venv"
if [ ! -d "$VENV" ]; then
  echo "[..]   Creating Python venv at $VENV"
  "$PY" -m venv "$VENV"
else
  echo "[OK]   venv already exists at $VENV"
fi
# shellcheck disable=SC1090
source "$VENV/bin/activate"
echo "[OK]   venv activated ($(python --version))"

echo "[..]   Installing Python deps into venv"
pip install --quiet --upgrade pip
pip install --quiet -r "$SKILL_DIR/requirements.txt"
echo "[OK]   Python deps installed (requests, Pillow)"

# ---- 4. Node deps ------------------------------------------------------------
cd "$SKILL_DIR"
if [ ! -d "node_modules" ]; then
  echo "[..]   Running npm install (playwright + sharp; downloads ~200MB)"
  npm install --no-audit --no-fund --silent
else
  echo "[OK]   node_modules already present"
fi
echo "[OK]   Node deps installed"

# ---- 5. Playwright browser ---------------------------------------------------
CHROMIUM_DIR="$HOME/Library/Caches/ms-playwright"
[ -d "$HOME/.cache/ms-playwright" ] && CHROMIUM_DIR="$HOME/.cache/ms-playwright"

if [ ! -d "$CHROMIUM_DIR" ] || [ -z "$(ls -A "$CHROMIUM_DIR"/chromium* 2>/dev/null)" ]; then
  echo "[..]   Installing Playwright Chromium (~150MB, one time)"
  npx --yes playwright install chromium
else
  echo "[OK]   Playwright Chromium already installed at $CHROMIUM_DIR"
fi

# ---- 6. Smoke test -----------------------------------------------------------
echo "[..]   Smoke test: launching Chromium headless"
node -e "(async () => { const { chromium } = require('playwright'); const b = await chromium.launch({ headless: true }); await b.close(); console.log('[OK]   Playwright works'); })().catch(e => { console.error('[FAIL] Playwright smoke test:', e.message); process.exit(1); })"

python -c "import requests, PIL; print('[OK]   Python deps importable (requests, Pillow)')"

echo "----------------------------------------"
echo "Bootstrap complete."
echo ""
echo "To activate the Python venv in your shell (only needed for manual debugging):"
echo "  source $VENV/bin/activate"
echo ""
echo "Next: run    node scripts/orchestrate.js <output-folder>"
