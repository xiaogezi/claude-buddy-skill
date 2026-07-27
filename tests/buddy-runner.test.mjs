/**
 * Unit tests for buddy-runner.mjs
 * Uses fake codebuddy executables - no real CodeBuddy required
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const RUNNER_PATH = join(process.cwd(), 'skills', 'buddy', 'scripts', 'buddy-runner.mjs');
const FIXTURES_DIR = join(process.cwd(), 'test-helpers');

// Create temp directory for tests
let tempDir;

function setup() {
  tempDir = join(tmpdir(), `buddy-test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
}

function teardown() {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runRunner(args, env = {}) {
  const result = spawnSync('node', [RUNNER_PATH, ...args], {
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, ...env },
  });

  let json;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    json = { parseError: true, stdout: result.stdout, stderr: result.stderr };
  }

  return { json, stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}

describe('buddy-runner.mjs', () => {
  beforeEach(setup);
  afterEach(teardown);

  // Test 1: PATH does not contain codebuddy
  test('doctor: returns not_installed when command not in PATH', () => {
    const result = runRunner(['doctor'], {
      PATH: '/usr/bin:/bin', // No codebuddy
    });

    assert.strictEqual(result.json.status, 'not_installed');
    assert.strictEqual(result.json.errorCode, 'CODEBUDDY_NOT_INSTALLED');
    assert.ok(result.json.message.includes('not installed'));
    assert.ok(result.json.suggestion.includes('Install'));
  });

  // Test 2: Configured non-existent absolute path
  test('doctor: returns not_installed for non-existent --binary path', () => {
    const fakePath = join(tempDir, 'nonexistent', 'codebuddy');
    const result = runRunner(['doctor', '--binary', fakePath]);

    assert.strictEqual(result.json.status, 'not_installed');
    assert.strictEqual(result.json.errorCode, 'CODEBUDDY_NOT_INSTALLED');
    assert.ok(result.json.binary.includes(fakePath));
  });

  // Test 3: File exists but not executable
  test('doctor: returns not_executable when file lacks execute permission', () => {
    const fakeBin = join(tempDir, 'codebuddy-noexec');
    writeFileSync(fakeBin, '#!/bin/bash\necho "test"\n');
    // No chmod +x

    const result = runRunner(['doctor', '--binary', fakeBin]);

    assert.strictEqual(result.json.status, 'not_executable');
    assert.strictEqual(result.json.errorCode, 'CODEBUDDY_NOT_EXECUTABLE');
    assert.ok(result.json.suggestion.includes('chmod +x'));
  });

  // Test 4: --version returns non-zero
  test('doctor: returns version_check_failed when --version fails', () => {
    const fakeBin = join(tempDir, 'codebuddy-version-fail');
    writeFileSync(fakeBin, '#!/bin/bash\necho "error" >&2\nexit 1\n');
    chmodSync(fakeBin, 0o755);

    const result = runRunner(['doctor', '--binary', fakeBin]);

    assert.strictEqual(result.json.status, 'version_check_failed');
    assert.strictEqual(result.json.errorCode, 'CODEBUDDY_VERSION_CHECK_FAILED');
  });

  // Test 5: Normal version return
  test('doctor: returns ready when version check succeeds', () => {
    const fakeBin = join(tempDir, 'codebuddy-ok');
    writeFileSync(fakeBin, '#!/bin/bash\necho "codebuddy 1.2.3"\nexit 0\n');
    chmodSync(fakeBin, 0o755);

    const result = runRunner(['doctor', '--binary', fakeBin]);

    assert.strictEqual(result.json.status, 'ready');
    assert.ok(result.json.version.includes('1.2.3'));
    assert.strictEqual(result.json.errorCode, undefined);
  });

  // Test 6: Auth error on startup (simulated via version check fail with specific message)
  test('doctor: version check failure can indicate auth issue', () => {
    const fakeBin = join(tempDir, 'codebuddy-auth');
    writeFileSync(fakeBin, '#!/bin/bash\necho "authentication required" >&2\nexit 1\n');
    chmodSync(fakeBin, 0o755);

    const result = runRunner(['doctor', '--binary', fakeBin]);

    // The generic handler returns version_check_failed
    assert.strictEqual(result.json.status, 'version_check_failed');
    assert.strictEqual(result.json.errorCode, 'CODEBUDDY_VERSION_CHECK_FAILED');
  });

  // Test 7: Doctor success but run fails
  test('run: returns failed when process exits with error', () => {
    const fakeBin = join(tempDir, 'codebuddy-run-fail');
    writeFileSync(fakeBin, '#!/bin/bash\nif [ "$1" = "--version" ]; then\necho "codebuddy 1.0.0"\nexit 0\nfi\necho "error" >&2\nexit 127\n');
    chmodSync(fakeBin, 0o755);

    const projectDir = join(tempDir, 'project');
    mkdirSync(projectDir);

    const result = runRunner(['run', '--binary', fakeBin, '--cwd', projectDir, '--task', 'test']);

    // Run should return failed or partial depending on output
    assert.ok(['failed', 'partial', 'unknown'].includes(result.json.status));
    assert.ok(result.json.runId);
    assert.strictEqual(result.json.cwd, projectDir);
  });

  // Test 8: Run without --cwd
  test('run: returns blocked when --cwd is missing', () => {
    const result = runRunner(['run', '--task', 'test']);

    assert.strictEqual(result.json.status, 'blocked');
    assert.strictEqual(result.json.errorCode, 'PREFLIGHT_FAILED');
    assert.ok(result.json.message.includes('--cwd'));
  });

  // Test 9: Run without --task
  test('run: returns blocked when --task is missing', () => {
    const result = runRunner(['run', '--cwd', tempDir]);

    assert.strictEqual(result.json.status, 'blocked');
    assert.strictEqual(result.json.errorCode, 'PREFLIGHT_FAILED');
    assert.ok(result.json.message.includes('--task'));
  });

  // Test 10: Continue without --session
  test('continue: returns blocked when --session is missing', () => {
    const result = runRunner(['continue', '--cwd', tempDir]);

    assert.strictEqual(result.json.status, 'blocked');
    assert.strictEqual(result.json.errorCode, 'SESSION_ID_REQUIRED');
    assert.ok(result.json.message.includes('session ID'));
  });

  // Test 11: Successful run creates evidence
  test('run: creates evidence directory on success', () => {
    const fakeBin = join(tempDir, 'codebuddy-success');
    writeFileSync(fakeBin, `#!/bin/bash
if [ "$1" = "--version" ]; then
  echo "codebuddy 1.0.0"
  exit 0
fi
echo '{"sessionId": "test-session-123", "summary": "Done"}'
exit 0
`);
    chmodSync(fakeBin, 0o755);

    const projectDir = join(tempDir, 'project2');
    mkdirSync(projectDir);

    const result = runRunner(['run', '--binary', fakeBin, '--cwd', projectDir, '--task', 'test task']);

    assert.strictEqual(result.json.status, 'completed');
    assert.ok(result.json.evidenceDir);

    // Check evidence files exist
    const evidenceDir = result.json.evidenceDir;
    assert.ok(existsSync(join(evidenceDir, 'request.json')));
    assert.ok(existsSync(join(evidenceDir, 'prompt.md')));
    assert.ok(existsSync(join(evidenceDir, 'stdout.log')));
    assert.ok(existsSync(join(evidenceDir, 'stderr.log')));
    assert.ok(existsSync(join(evidenceDir, 'raw.json')));
    assert.ok(existsSync(join(evidenceDir, 'result.json')));
  });

  // Test 12: Unknown command
  test('returns error for unknown command', () => {
    const result = runRunner(['unknown-command']);

    assert.strictEqual(result.json.status, 'error');
    assert.ok(result.json.message.includes('Unknown'));
  });

  // Test 13: CODEBUDDY_BIN environment variable
  test('doctor: respects CODEBUDDY_BIN environment variable', () => {
    const fakeBin = join(tempDir, 'codebuddy-env');
    writeFileSync(fakeBin, '#!/bin/bash\necho "codebuddy 2.0.0"\nexit 0\n');
    chmodSync(fakeBin, 0o755);

    const result = runRunner(['doctor'], {
      CODEBUDDY_BIN: fakeBin,
    });

    assert.strictEqual(result.json.status, 'ready');
    assert.strictEqual(result.json.binary, fakeBin);
  });

  // Test 14: Preflight failure on run
  test('run: returns blocked with preflight error when doctor fails', () => {
    const nonexistentBin = join(tempDir, 'does-not-exist', 'codebuddy');

    const result = runRunner(['run', '--binary', nonexistentBin, '--cwd', tempDir, '--task', 'test']);

    assert.strictEqual(result.json.status, 'blocked');
    assert.ok(['CODEBUDDY_NOT_INSTALLED', 'PREFLIGHT_FAILED'].includes(result.json.errorCode));
  });

  // Test 15: Continue with session ID but preflight fails
  test('continue: returns blocked when preflight fails', () => {
    const nonexistentBin = join(tempDir, 'does-not-exist', 'codebuddy');

    const result = runRunner(['continue', '--binary', nonexistentBin, '--session', 'abc123', '--cwd', tempDir]);

    assert.strictEqual(result.json.status, 'blocked');
  });
});