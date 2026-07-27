#!/bin/bash
# Fake CodeBuddy that returns non-zero for --version
echo "error: not authenticated" >&2
exit 1