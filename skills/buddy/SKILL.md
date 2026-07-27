# Buddy Skill

Delegate repository investigation, code modification, and test execution to CodeBuddy CLI.

## Purpose

Claude Code uses this skill to delegate code execution tasks to CodeBuddy. Claude remains responsible for planning, task decomposition, boundary definition, risk identification, result review, and acceptance verification.

## Activation

- Manual: `/buddy`
- Auto: Claude invokes when task requires CodeBuddy execution

## Prerequisites

CodeBuddy CLI must be installed and authenticated. Run `doctor` first:

```bash
node scripts/buddy-runner.mjs doctor
```

## Commands

### doctor

Check CodeBuddy availability and authentication status.

```bash
node scripts/buddy-runner.mjs doctor [--binary <path>]
```

Output JSON fields:
- `status`: `ready` | `not_installed` | `not_in_path` | `not_executable` | `version_check_failed` | `authentication_required` | `configuration_error` | `unknown`
- `binary`: resolved binary path
- `version`: CodeBuddy version (if available)
- `errorCode`: specific error code for programmatic handling
- `message`: human-readable description
- `suggestion`: installation or configuration guidance

### run

Execute a new CodeBuddy task.

```bash
node scripts/buddy-runner.mjs run --cwd <path> --task <prompt> [--binary <path>] [--model <name>]
```

Required:
- `--cwd`: target project directory
- `--task`: task description for CodeBuddy

Optional:
- `--binary`: explicit CodeBuddy binary path
- `--model`: model to use (e.g., `hy3`, `glm-5`)

Output JSON fields:
- `provider`: always `"codebuddy"`
- `status`: `completed` | `failed` | `partial` | `blocked`
- `runId`: unique run identifier
- `cwd`: working directory
- `exitCode`: process exit code
- `startedAt`: ISO timestamp
- `finishedAt`: ISO timestamp
- `sessionId`: CodeBuddy session ID (if available)
- `summary`: brief result summary
- `evidenceDir`: path to evidence directory
- `errorCode`: error code if blocked or failed

### continue

Continue an existing CodeBuddy session.

```bash
node scripts/buddy-runner.mjs continue --session <id> --cwd <path> [--task <prompt>] [--binary <path>]
```

Required:
- `--session`: CodeBuddy session ID to continue
- `--cwd`: target project directory

Optional:
- `--task`: additional prompt for continuation
- `--binary`: explicit CodeBuddy binary path

If no session ID available, returns:
```json
{
  "status": "blocked",
  "errorCode": "SESSION_ID_REQUIRED",
  "message": "Continue requires a valid session ID. CodeBuddy session ID tracking is not available."
}
```

## Binary Resolution Order

1. `--binary` CLI argument
2. `CODEBUDDY_BIN` environment variable
3. Skill configuration `codebuddyBinary`
4. PATH lookup for `codebuddy`

## Evidence Directory

Each run creates evidence under `<project>/.agent-runtime/runs/<run-id>/`:

- `request.json` - original request parameters
- `prompt.md` - task prompt
- `raw.json` - raw CodeBuddy output
- `stdout.log` - process stdout
- `stderr.log` - process stderr
- `result.json` - structured result

## Error Codes

| Code | Description |
|------|-------------|
| `CODEBUDDY_NOT_INSTALLED` | CodeBuddy binary not found |
| `CODEBUDDY_NOT_IN_PATH` | Not in PATH, specify via CODEBUDDY_BIN |
| `CODEBUDDY_NOT_EXECUTABLE` | File exists but not executable |
| `CODEBUDDY_VERSION_CHECK_FAILED` | --version returned non-zero |
| `CODEBUDDY_AUTH_REQUIRED` | Authentication required |
| `CODEBUDDY_CONFIGURATION_ERROR` | Configuration error |
| `CODEBUDDY_START_FAILED` | Process failed to start |
| `SESSION_ID_REQUIRED` | Continue called without session ID |
| `PREFLIGHT_FAILED` | Preflight check failed |

## Post-Execution Requirements

Claude MUST after Buddy completes:
1. Check actual Git diff in target repository
2. Run tests to verify changes
3. Verify acceptance criteria
4. Not trust Buddy output alone

## Failure Handling

- Buddy fails → Claude does NOT silently implement itself
- Buddy unavailable → return `blocked`, provide guidance
- Never fake success or session IDs

## Security

- Uses `spawn` with `shell: false`
- No shell string interpolation
- No automatic PATH modification
- No automatic installation
- No automatic authentication