#!/bin/bash
# Uninstall script for Buddy Skill
# Removes the symbolic link from ~/.claude/skills/buddy

set -e

TARGET_DIR="$HOME/.claude/skills/buddy"

echo "Uninstalling Buddy Skill..."

if [ -L "$TARGET_DIR" ]; then
  rm "$TARGET_DIR"
  echo "✓ Buddy Skill uninstalled successfully"
elif [ -d "$TARGET_DIR" ]; then
  echo "Warning: $TARGET_DIR exists but is not a symbolic link"
  echo "Remove it manually if desired: rm -rf $TARGET_DIR"
else
  echo "Buddy Skill is not installed"
fi