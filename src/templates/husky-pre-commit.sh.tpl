#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx p5 test --stage pre-commit
