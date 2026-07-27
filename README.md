# Claude Buddy Skill

A Claude Code Skill for delegating code execution tasks to CodeBuddy CLI.

[中文说明](README_CN.md)

## Overview

This skill enables Claude Code to delegate repository investigation, code modification, and test execution to CodeBuddy. Claude remains responsible for:

- Planning and task decomposition
- Boundary and acceptance criteria definition
- Risk identification
- Result review and verification

## Installation

```bash
cd claude-buddy-skill
./install.sh
```

This creates a symbolic link: `~/.claude/skills/buddy` → `./skills/buddy`

## Uninstallation

```bash
./uninstall.sh
```

## Prerequisites: CodeBuddy CLI

**CodeBuddy must be installed and authenticated before use.**

### Check Availability

```bash
node ~/.claude/skills/buddy/scripts/buddy-runner.mjs doctor
```

### When CodeBuddy is Not Installed

If you run commands without CodeBuddy installed, you'll receive:

```json
{
  "status": "not_installed",
  "errorCode": "CODEBUDDY_NOT_INSTALLED",
  "message": "CodeBuddy is not installed or not in PATH",
  "suggestion": "Install CodeBuddy CLI first..."
}
```

### Specifying Binary Path

If CodeBuddy is installed in a non-standard location:

```bash
# Via environment variable
export CODEBUDDY_BIN=/path/to/codebuddy

# Or via --binary argument
node buddy-runner.mjs doctor --binary /path/to/codebuddy
```

### Re-checking After Installation

After installing CodeBuddy:

```bash
node ~/.claude/skills/buddy/scripts/buddy-runner.mjs doctor
```

Expected output when ready:

```json
{
  "status": "ready",
  "binary": "codebuddy",
  "version": "1.2.3",
  "message": "CodeBuddy is ready (version: 1.2.3)"
}
```

### Why Skill Doesn't Auto-Install

- **Security**: Automatic installation could modify your system unexpectedly
- **Control**: You should choose where and how to install CodeBuddy
- **Authentication**: CodeBuddy requires manual authentication
- **Version management**: You control which version is installed

## Usage

### Manual Invocation

In Claude Code, type:

```
/buddy
```

### Doctor Command

Check CodeBuddy availability:

```bash
node scripts/buddy-runner.mjs doctor
node scripts/buddy-runner.mjs doctor --binary /custom/path/codebuddy
```

Possible statuses:

| Status | Description |
|--------|-------------|
| `ready` | CodeBuddy installed and working |
| `not_installed` | Binary not found |
| `not_in_path` | Exists but not in PATH |
| `not_executable` | File exists but lacks execute permission |
| `version_check_failed` | `--version` returned non-zero |
| `authentication_required` | Needs authentication |
| `configuration_error` | Configuration issue |
| `unknown` | Unable to determine status |

### Run Command

Execute a new task:

```bash
node scripts/buddy-runner.mjs run \
  --cwd /path/to/project \
  --task "Add unit tests for UserService"
```

### Continue Command

Continue an existing session:

```bash
node scripts/buddy-runner.mjs continue \
  --session abc123 \
  --cwd /path/to/project
```

**Note**: If you don't have a session ID, the skill reports a capability gap - it does not fake session tracking.

## Output Format

All commands output JSON. Example `run` output:

```json
{
  "provider": "codebuddy",
  "status": "completed",
  "runId": "run-1722051600000-a1b2c3d4",
  "cwd": "/path/to/project",
  "exitCode": 0,
  "startedAt": "2026-07-27T02:00:00.000Z",
  "finishedAt": "2026-07-27T02:05:00.000Z",
  "sessionId": "abc123",
  "summary": "Added unit tests for UserService",
  "evidenceDir": "/path/to/project/.agent-runtime/runs/run-1722051600000-a1b2c3d4"
}
```

### Status Values

| Status | Meaning |
|--------|---------|
| `completed` | Task finished with session ID and summary |
| `failed` | Non-zero exit code or error |
| `partial` | Zero exit code but incomplete output |
| `unknown` | Cannot determine outcome |
| `blocked` | Preflight failed, cannot start |

## Evidence Directory

Each run creates files under `<project>/.agent-runtime/runs/<run-id>/`:

- `request.json` - Original request parameters
- `prompt.md` - Task prompt
- `raw.json` - Raw output (truncated)
- `stdout.log` - Full stdout
- `stderr.log` - Full stderr
- `result.json` - Structured result

## Error Codes

| Code | Description |
|------|-------------|
| `CODEBUDDY_NOT_INSTALLED` | Binary not found |
| `CODEBUDDY_NOT_IN_PATH` | Not in PATH |
| `CODEBUDDY_NOT_EXECUTABLE` | No execute permission |
| `CODEBUDDY_VERSION_CHECK_FAILED` | Version check failed |
| `CODEBUDDY_AUTH_REQUIRED` | Authentication needed |
| `CODEBUDDY_CONFIGURATION_ERROR` | Config error |
| `CODEBUDDY_START_FAILED` | Process failed to start |
| `SESSION_ID_REQUIRED` | Continue without session |
| `PREFLIGHT_FAILED` | Preflight check failed |

## Post-Execution Verification

**Claude MUST verify results after Buddy completes:**

1. Check actual Git diff in target repository
2. Run tests to verify changes
3. Verify acceptance criteria
4. Not trust Buddy output alone

**Exit code 0 ≠ success** - The skill uses `partial` or `unknown` status when it cannot confirm success.

## Failure Handling

- Buddy fails → Claude does NOT silently implement itself
- Buddy unavailable → returns `blocked`, provides guidance
- Never fakes success or session IDs

## Development

### Running Tests

```bash
npm test
```

Tests use fake `codebuddy` executables and do not require real CodeBuddy installation.

### Project Structure

```
claude-buddy-skill/
├── skills/buddy/
│   ├── SKILL.md           # Skill documentation
│   └── scripts/
│       └── buddy-runner.mjs  # Main runner
├── tests/
│   └── buddy-runner.test.mjs
├── test-helpers/
│   └── fake-codebuddy.sh
├── install.sh
├── uninstall.sh
├── package.json
└── README.md
```

## Security

- Uses `spawn` with `shell: false` - no shell interpolation
- No automatic PATH modification
- No automatic installation
- No automatic authentication
- All operations require explicit user action

## License

MIT