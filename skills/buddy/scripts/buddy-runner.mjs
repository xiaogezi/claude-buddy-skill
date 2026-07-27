#!/usr/bin/env node

/**
 * Buddy Runner - CodeBuddy CLI wrapper for Claude Code Skill
 *
 * Uses child_process.spawn with shell: false for security.
 * No shell string interpolation.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync, readFileSync, accessSync, constants } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);

// Error codes
const ERROR_CODES = {
  CODEBUDDY_NOT_INSTALLED: 'CODEBUDDY_NOT_INSTALLED',
  CODEBUDDY_NOT_IN_PATH: 'CODEBUDDY_NOT_IN_PATH',
  CODEBUDDY_NOT_EXECUTABLE: 'CODEBUDDY_NOT_EXECUTABLE',
  CODEBUDDY_VERSION_CHECK_FAILED: 'CODEBUDDY_VERSION_CHECK_FAILED',
  CODEBUDDY_AUTH_REQUIRED: 'CODEBUDDY_AUTH_REQUIRED',
  CODEBUDDY_CONFIGURATION_ERROR: 'CODEBUDDY_CONFIGURATION_ERROR',
  CODEBUDDY_START_FAILED: 'CODEBUDDY_START_FAILED',
  SESSION_ID_REQUIRED: 'SESSION_ID_REQUIRED',
  PREFLIGHT_FAILED: 'PREFLIGHT_FAILED',
};

// Doctor status values
const DOCTOR_STATUS = {
  READY: 'ready',
  NOT_INSTALLED: 'not_installed',
  NOT_IN_PATH: 'not_in_path',
  NOT_EXECUTABLE: 'not_executable',
  VERSION_CHECK_FAILED: 'version_check_failed',
  AUTHENTICATION_REQUIRED: 'authentication_required',
  CONFIGURATION_ERROR: 'configuration_error',
  UNKNOWN: 'unknown',
};

/**
 * Resolve CodeBuddy binary path
 * Priority: --binary > CODEBUDDY_BIN > config file > PATH
 */
function resolveBinary(explicitBinary) {
  if (explicitBinary) {
    return resolve(explicitBinary);
  }

  if (process.env.CODEBUDDY_BIN) {
    return resolve(process.env.CODEBUDDY_BIN);
  }

  // Try config file
  const configPath = join(dirname(new URL(import.meta.url).pathname), '..', 'config.json');
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      if (config.codebuddyBinary) {
        return resolve(config.codebuddyBinary);
      }
    } catch {
      // Ignore config errors
    }
  }

  // Return 'codebuddy' for PATH lookup
  return 'codebuddy';
}

/**
 * Check if a file exists and is executable
 */
function checkExecutable(filePath) {
  try {
    if (!existsSync(filePath)) {
      return { ok: false, reason: 'not_found' };
    }
    accessSync(filePath, constants.X_OK);
    return { ok: true };
  } catch (err) {
    if (err.code === 'EACCES') {
      return { ok: false, reason: 'not_executable' };
    }
    return { ok: false, reason: 'access_error', error: err };
  }
}

/**
 * Run CodeBuddy --version synchronously
 */
function checkVersion(binary) {
  const result = spawnSync(binary, ['--version'], {
    encoding: 'utf8',
    timeout: 10000,
    shell: false,
  });

  return {
    success: result.status === 0,
    version: result.status === 0 ? result.stdout.trim() : null,
    stderr: result.stderr,
    error: result.error,
  };
}

/**
 * Doctor command - check CodeBuddy availability
 */
async function doctor(args) {
  const binary = resolveBinary(args.binary);
  const result = {
    status: DOCTOR_STATUS.UNKNOWN,
    binary: binary,
    version: null,
    errorCode: null,
    message: '',
    suggestion: '',
  };

  // Check if it's a PATH lookup or explicit path
  const isPathLookup = binary === 'codebuddy' && !binary.includes('/');

  // Check executable status
  if (!isPathLookup) {
    const execCheck = checkExecutable(binary);
    if (!execCheck.ok) {
      if (execCheck.reason === 'not_found') {
        result.status = DOCTOR_STATUS.NOT_INSTALLED;
        result.errorCode = ERROR_CODES.CODEBUDDY_NOT_INSTALLED;
        result.message = `CodeBuddy binary not found at: ${binary}`;
        result.suggestion = `Install CodeBuddy or set CODEBUDDY_BIN environment variable to the correct path.`;
      } else if (execCheck.reason === 'not_executable') {
        result.status = DOCTOR_STATUS.NOT_EXECUTABLE;
        result.errorCode = ERROR_CODES.CODEBUDDY_NOT_EXECUTABLE;
        result.message = `CodeBuddy binary exists but is not executable: ${binary}`;
        result.suggestion = `Run: chmod +x ${binary}`;
      } else {
        result.status = DOCTOR_STATUS.CONFIGURATION_ERROR;
        result.errorCode = ERROR_CODES.CODEBUDDY_CONFIGURATION_ERROR;
        result.message = `Cannot access CodeBuddy binary: ${execCheck.error?.message || 'unknown error'}`;
        result.suggestion = `Check file permissions for: ${binary}`;
      }
      return result;
    }
  }

  // Try to get version
  const versionCheck = checkVersion(binary);

  if (versionCheck.error) {
    if (versionCheck.error.code === 'ENOENT') {
      result.status = DOCTOR_STATUS.NOT_INSTALLED;
      result.errorCode = ERROR_CODES.CODEBUDDY_NOT_INSTALLED;
      result.message = `CodeBuddy is not installed or not in PATH`;
      result.suggestion = `Install CodeBuddy CLI first. Visit the official documentation for installation instructions, or set CODEBUDDY_BIN if installed in a custom location.`;
    } else if (versionCheck.error.code === 'EACCES') {
      result.status = DOCTOR_STATUS.NOT_EXECUTABLE;
      result.errorCode = ERROR_CODES.CODEBUDDY_NOT_EXECUTABLE;
      result.message = `CodeBuddy binary is not executable`;
      result.suggestion = `Run: chmod +x $(which codebuddy)`;
    } else {
      result.status = DOCTOR_STATUS.CONFIGURATION_ERROR;
      result.errorCode = ERROR_CODES.CODEBUDDY_CONFIGURATION_ERROR;
      result.message = `Failed to execute CodeBuddy: ${versionCheck.error.message}`;
      result.suggestion = `Check your CodeBuddy installation`;
    }
    return result;
  }

  if (versionCheck.success) {
    result.status = DOCTOR_STATUS.READY;
    result.version = versionCheck.version;
    result.message = `CodeBuddy is ready (version: ${versionCheck.version})`;
    result.suggestion = `Ready to use. Run 'buddy run --cwd <path> --task <prompt>' to execute a task.`;
  } else {
    result.status = DOCTOR_STATUS.VERSION_CHECK_FAILED;
    result.errorCode = ERROR_CODES.CODEBUDDY_VERSION_CHECK_FAILED;
    result.message = `CodeBuddy --version returned non-zero exit code`;
    result.suggestion = `CodeBuddy may need authentication or configuration. Run 'codebuddy auth login' or check the documentation.`;
  }

  return result;
}

/**
 * Create evidence directory and files
 */
function createEvidence(cwd, runId, request, prompt, stdout, stderr, result) {
  const evidenceDir = join(cwd, '.agent-runtime', 'runs', runId);

  mkdirSync(evidenceDir, { recursive: true });

  writeFileSync(join(evidenceDir, 'request.json'), JSON.stringify(request, null, 2));
  writeFileSync(join(evidenceDir, 'prompt.md'), prompt);
  writeFileSync(join(evidenceDir, 'stdout.log'), stdout);
  writeFileSync(join(evidenceDir, 'stderr.log'), stderr);

  const rawOutput = {
    stdout: stdout.substring(0, 10000), // Truncate large outputs
    stderr: stderr.substring(0, 10000),
    timestamp: new Date().toISOString(),
  };
  writeFileSync(join(evidenceDir, 'raw.json'), JSON.stringify(rawOutput, null, 2));
  writeFileSync(join(evidenceDir, 'result.json'), JSON.stringify(result, null, 2));

  return evidenceDir;
}

/**
 * Run command - execute a new CodeBuddy task
 */
async function run(args) {
  const { cwd, task, binary, model } = args;

  if (!cwd) {
    return {
      provider: 'codebuddy',
      status: 'blocked',
      errorCode: ERROR_CODES.PREFLIGHT_FAILED,
      message: '--cwd is required',
    };
  }

  if (!task) {
    return {
      provider: 'codebuddy',
      status: 'blocked',
      errorCode: ERROR_CODES.PREFLIGHT_FAILED,
      message: '--task is required',
    };
  }

  // Preflight check
  const preflight = await doctor({ binary: args.binary });

  if (preflight.status !== DOCTOR_STATUS.READY) {
    return {
      provider: 'codebuddy',
      status: 'blocked',
      errorCode: preflight.errorCode,
      message: `Preflight failed: ${preflight.message}`,
      suggestion: preflight.suggestion,
    };
  }

  const resolvedBinary = preflight.binary;
  const runId = `run-${Date.now()}-${randomUUID().substring(0, 8)}`;
  const startedAt = new Date().toISOString();

  // Build CodeBuddy args
  // Note: CodeBuddy does not have --cwd, it uses process working directory
  const buddyArgs = ['-p', '--output-format', 'json', '--permission-mode', 'auto'];

  if (model) {
    buddyArgs.push('--model', model);
  }

  buddyArgs.push(task);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(resolvedBinary, buddyArgs, {
      cwd: cwd,
      shell: false,
      env: { ...process.env },
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      const result = {
        provider: 'codebuddy',
        status: 'failed',
        errorCode: ERROR_CODES.CODEBUDDY_START_FAILED,
        runId,
        cwd,
        exitCode: null,
        startedAt,
        finishedAt: new Date().toISOString(),
        sessionId: null,
        summary: `Failed to start CodeBuddy: ${err.message}`,
        evidenceDir: null,
      };

      createEvidence(cwd, runId, args, task, stdout, stderr, result);
      resolve(result);
    });

    proc.on('close', (code) => {
      const finishedAt = new Date().toISOString();

      // Parse session ID from output if available
      let sessionId = null;
      let summary = '';

      try {
        const parsed = JSON.parse(stdout);
        sessionId = parsed.sessionId || parsed.session_id || null;
        summary = parsed.summary || parsed.message || '';
      } catch {
        // Try to extract from stderr or stdout
        const sessionMatch = stdout.match(/session[_-]?id[:\s]+([a-zA-Z0-9-]+)/i) ||
                             stderr.match(/session[_-]?id[:\s]+([a-zA-Z0-9-]+)/i);
        if (sessionMatch) {
          sessionId = sessionMatch[1];
        }
        summary = stdout.split('\n')[0].substring(0, 200) || stderr.split('\n')[0].substring(0, 200);
      }

      // Determine status - exit code 0 does not guarantee success
      let status;
      if (code !== 0) {
        status = 'failed';
      } else if (sessionId && summary) {
        status = 'completed';
      } else if (stdout.length > 0 || stderr.length === 0) {
        status = 'partial';
      } else {
        status = 'unknown';
      }

      const result = {
        provider: 'codebuddy',
        status,
        runId,
        cwd,
        exitCode: code,
        startedAt,
        finishedAt,
        sessionId,
        summary: summary || 'CodeBuddy completed (verify actual results)',
        evidenceDir: join(cwd, '.agent-runtime', 'runs', runId),
      };

      createEvidence(cwd, runId, args, task, stdout, stderr, result);
      resolve(result);
    });
  });
}

/**
 * Continue command - continue an existing session
 */
async function continueSession(args) {
  const { session, cwd, task, binary } = args;

  if (!session) {
    return {
      provider: 'codebuddy',
      status: 'blocked',
      errorCode: ERROR_CODES.SESSION_ID_REQUIRED,
      message: 'Continue requires a valid session ID. CodeBuddy session ID tracking is not available.',
      suggestion: 'Provide --session with a valid CodeBuddy session ID from a previous run.',
    };
  }

  if (!cwd) {
    return {
      provider: 'codebuddy',
      status: 'blocked',
      errorCode: ERROR_CODES.PREFLIGHT_FAILED,
      message: '--cwd is required',
    };
  }

  // Preflight check
  const preflight = await doctor({ binary: args.binary });

  if (preflight.status !== DOCTOR_STATUS.READY) {
    return {
      provider: 'codebuddy',
      status: 'blocked',
      errorCode: preflight.errorCode,
      message: `Preflight failed: ${preflight.message}`,
      suggestion: preflight.suggestion,
    };
  }

  const resolvedBinary = preflight.binary;
  const runId = `run-${Date.now()}-${randomUUID().substring(0, 8)}`;
  const startedAt = new Date().toISOString();

  // Build CodeBuddy args for continue
  // Note: CodeBuddy uses -c/--continue for most recent, -r/--resume for session
  // --resume can take a sessionId or interactively select
  const buddyArgs = ['-p', '--output-format', 'json', '--permission-mode', 'auto'];
  buddyArgs.push('--resume', session);

  if (task) {
    buddyArgs.push(task);
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(resolvedBinary, buddyArgs, {
      cwd: cwd,
      shell: false,
      env: { ...process.env },
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      const result = {
        provider: 'codebuddy',
        status: 'failed',
        errorCode: ERROR_CODES.CODEBUDDY_START_FAILED,
        runId,
        cwd,
        exitCode: null,
        startedAt,
        finishedAt: new Date().toISOString(),
        sessionId: session,
        summary: `Failed to start CodeBuddy: ${err.message}`,
        evidenceDir: null,
      };

      createEvidence(cwd, runId, args, task || '(continue)', stdout, stderr, result);
      resolve(result);
    });

    proc.on('close', (code) => {
      const finishedAt = new Date().toISOString();

      let sessionId = session;
      let summary = '';

      try {
        const parsed = JSON.parse(stdout);
        sessionId = parsed.sessionId || parsed.session_id || session;
        summary = parsed.summary || parsed.message || '';
      } catch {
        summary = stdout.split('\n')[0].substring(0, 200) || stderr.split('\n')[0].substring(0, 200);
      }

      let status;
      if (code !== 0) {
        status = 'failed';
      } else if (stdout.length > 0) {
        status = 'partial';
      } else {
        status = 'unknown';
      }

      const result = {
        provider: 'codebuddy',
        status,
        runId,
        cwd,
        exitCode: code,
        startedAt,
        finishedAt,
        sessionId,
        summary: summary || 'CodeBuddy continue completed (verify actual results)',
        evidenceDir: join(cwd, '.agent-runtime', 'runs', runId),
      };

      createEvidence(cwd, runId, args, task || '(continue)', stdout, stderr, result);
      resolve(result);
    });
  });
}

/**
 * Parse CLI arguments
 */
function parseArgs(argv) {
  const args = {
    command: null,
    binary: null,
    cwd: null,
    task: null,
    session: null,
    model: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--binary' && i + 1 < argv.length) {
      args.binary = argv[++i];
    } else if (arg === '--cwd' && i + 1 < argv.length) {
      args.cwd = argv[++i];
    } else if (arg === '--task' && i + 1 < argv.length) {
      args.task = argv[++i];
    } else if (arg === '--session' && i + 1 < argv.length) {
      args.session = argv[++i];
    } else if (arg === '--model' && i + 1 < argv.length) {
      args.model = argv[++i];
    } else if (!arg.startsWith('-') && !args.command) {
      args.command = arg;
    }
  }

  return args;
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  let result;

  switch (args.command) {
    case 'doctor':
      result = await doctor(args);
      break;
    case 'run':
      result = await run(args);
      break;
    case 'continue':
      result = await continueSession(args);
      break;
    default:
      result = {
        status: 'error',
        message: `Unknown command: ${args.command || '(none)'}`,
        usage: 'buddy-runner.mjs <doctor|run|continue> [options]',
      };
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({
    status: 'error',
    message: err.message,
  }, null, 2));
  process.exit(1);
});