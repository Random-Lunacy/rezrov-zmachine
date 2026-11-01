#!/usr/bin/env bash
# Smoke-test the packed tarball the way a consumer would install it.
#
# The unit tests in tests/unit/packaging/ check the exports map and the import graph statically, and
# the examples link the repo with "file:..", which hides mistakes in `files`, `exports` and
# `typesVersions`. This script packs the package, installs the tarball into an empty project and checks:
#   - both entry points load via import(), and the main entry via require()
#   - a story file loads through memoryFromFile
#   - a small TypeScript consumer compiles under bundler and node10 module resolution
#
# Usage: tools/smoke-test.sh [path/to/package.tgz]
# With no argument it builds nothing: run `npm run build` first, since `npm pack` ships dist/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="@random-lunacy/rezrov-zmachine"
FIXTURE="$ROOT/tests/fixtures/je_test.z3"

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK:?}"' EXIT

dev_version() {
  node -e "console.log(require(process.argv[1]).devDependencies[process.argv[2]])" "$ROOT/package.json" "$1"
}

if [[ $# -ge 1 ]]; then
  TARBALL="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
else
  if [[ ! -f "$ROOT/dist/index.js" ]]; then
    echo "dist/ is missing: run 'npm run build' first" >&2
    exit 1
  fi
  mkdir "$WORK/pack"
  (cd "$ROOT" && npm pack --silent --pack-destination "$WORK/pack" >/dev/null)
  TARBALL="$(ls "$WORK"/pack/*.tgz)"
fi
echo "Tarball: $TARBALL"

CONSUMER="$WORK/consumer"
mkdir "$CONSUMER"
cd "$CONSUMER"
npm init -y >/dev/null
# Match the versions the repo itself builds with, so the check does not drift with the registry.
npm install --silent --no-audit --no-fund \
  "$TARBALL" "typescript@$(dev_version typescript)" "@types/node@$(dev_version @types/node)"

echo "== import() both entry points and load a story"
cat > check.mjs <<EOF
import { Memory, ZMachine } from '$PKG';
import { FileSystemProvider, createFileSystemStorage, memoryFromFile } from '$PKG/node';

for (const [name, value] of Object.entries({ Memory, ZMachine, FileSystemProvider, createFileSystemStorage, memoryFromFile })) {
  if (typeof value !== 'function') throw new Error(name + ' is not exported');
}
const memory = memoryFromFile(process.argv[2]);
if (!(memory instanceof Memory)) throw new Error('memoryFromFile did not return a Memory');
if (memory.version !== 3) throw new Error('expected a V3 story, got V' + memory.version);
console.log('ok: loaded V' + memory.version + ' story');
EOF
node check.mjs "$FIXTURE"

echo "== require() the main entry"
cat > check.cjs <<EOF
const { Memory } = require('$PKG');
if (typeof Memory !== 'function') throw new Error('Memory is not exported through require()');
console.log('ok: require() works');
EOF
node check.cjs

echo "== compile a TypeScript consumer under both resolution modes"
cat > consumer.ts <<EOF
import { Memory, ZMachine } from '$PKG';
import { memoryFromFile } from '$PKG/node';

const memory: Memory = memoryFromFile('story.z3');
const bytes: Uint8Array = new Uint8Array(0);
export type Machine = ZMachine;
export { bytes, memory };
EOF
npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler consumer.ts
echo "ok: bundler resolution"
npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution node10 consumer.ts
echo "ok: node10 resolution"

echo "Smoke test passed"
