#!/bin/bash
# Install script for Buddy Skill
# Links the skill to ~/.claude/skills/buddy

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SRC="$SCRIPT_DIR/skills/buddy"
TARGET_DIR="$HOME/.claude/skills/buddy"

echo "Installing Buddy Skill..."
echo "Source: $SKILL_SRC"
echo "Target: $TARGET_DIR"

# Create parent directory if needed
mkdir -p "$HOME/.claude/skills"

# Remove existing installation if any
if [ -e "$TARGET_DIR" ]; then
  echo "Removing existing installation..."
  rm -rf "$TARGET_DIR"
fi

# Create symbolic link
ln -s "$SKILL_SRC" "$TARGET_DIR"

echo "✓ Buddy Skill installed successfully"
echo ""
echo "Usage:"
echo "  /buddy                    - Manual invocation in Claude Code"
echo "  node ~/.claude/skills/buddy/scripts/buddy-runner.mjs doctor"
echo ""
echo "Run doctor to verify CodeBuddy availability:"
echo "  node ~/.claude/skills/buddy/scripts/buddy-runner.mjs doctor"