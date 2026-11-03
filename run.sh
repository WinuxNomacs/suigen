#!/usr/bin/env bash
# Sets up Suigen's dependencies if needed, then launches it (macOS / Linux).
#
# Usage: ./run.sh [--setup-only] [--web] [--dev]
#   --setup-only  install dependencies and the Electron binary, then exit
#   --web         run in your browser instead of the desktop app
#   --dev         open DevTools alongside the app
set -euo pipefail
cd "$(dirname "$0")"

REQUIRED_NODE="22.13.0"
mode="app"
devtools=0

for arg in "$@"; do
  case "$arg" in
    --setup-only) mode="setup" ;;
    --web) mode="web" ;;
    --dev) devtools=1 ;;
    -h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 1 ;;
  esac
done

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js $REQUIRED_NODE or newer is required but was not found." >&2
  case "$(uname -s)" in
    Darwin) echo "Install it with:  brew install node   (or download from https://nodejs.org)" >&2 ;;
    *)      echo "Install it from https://nodejs.org, or with a version manager:  https://github.com/Schniz/fnm" >&2 ;;
  esac
  exit 1
fi

if ! node -e "
  const [a, b] = process.versions.node.split('.').map(Number);
  const [ra, rb] = '$REQUIRED_NODE'.split('.').map(Number);
  process.exit(a > ra || (a === ra && b >= rb) ? 0 : 1);
"; then
  echo "Node.js $REQUIRED_NODE or newer is required (found $(node --version)). Please upgrade." >&2
  exit 1
fi

if grep -qi microsoft /proc/version 2>/dev/null; then
  echo "Note: running inside WSL. The app will open through WSLg; running natively on Windows (run.cmd) is faster."
fi

# Install when node_modules is missing or older than the lockfile.
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Installing dependencies..."
  npm ci
fi

if [ "$mode" != "web" ]; then
  # Electron downloads its binary on first use; do it now so failures surface here.
  node -e "require('electron')" >/dev/null
fi

case "$mode" in
  setup) echo "Setup complete. Start Suigen with ./run.sh" ;;
  web)   exec npm run web -- --open ;;
  app)
    [ "$devtools" = 1 ] || export SUIGEN_NO_DEVTOOLS=1
    exec npm start
    ;;
esac
