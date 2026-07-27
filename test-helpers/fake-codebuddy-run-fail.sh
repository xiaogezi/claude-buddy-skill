#!/bin/bash
# Fake CodeBuddy that returns success for --version but fails on run
if [ "$1" = "--version" ]; then
  echo "codebuddy-fake 1.0.0"
  exit 0
fi

# Any other command fails
echo "error: start failed" >&2
exit 127