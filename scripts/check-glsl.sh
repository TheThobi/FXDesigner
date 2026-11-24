#!/bin/sh
# Compiles every shader of the app with glslangValidator: a fast WebGL2 (GLSL ES 3.00) check
# without a browser. Runs inside the Node Alpine image (`make glsl`).
set -e
out=/tmp/glsl-dump
GLSL_DUMP="$out" npx vitest run tests/unit/glsl-dump.test.ts > /dev/null
apk add -q glslang > /dev/null
fail=0
for f in "$out"/*; do
  if ! glslangValidator "$f" > /tmp/glsl-log 2>&1; then
    echo "FAIL $f"
    grep ERROR /tmp/glsl-log || cat /tmp/glsl-log
    fail=1
  fi
done
echo "$(ls "$out" | wc -l) shaders checked"
exit $fail
