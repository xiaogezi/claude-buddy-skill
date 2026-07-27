#!/bin/bash
# Fake CodeBuddy executable for unit tests
# Simulates various CodeBuddy behaviors based on arguments

case "$1" in
  --version)
    # Check for version check failure simulation
    if [ "${FAKE_CODEBUDDY_VERSION_FAIL}" = "1" ]; then
      echo "error: version check failed" >&2
      exit 1
    fi
    echo "codebuddy-fake 1.0.0"
    exit 0
    ;;

  -p)
    # Running in non-interactive mode
    # Simulate different outputs based on FAKE_CODEBUDDY_OUTPUT

    shift # Remove -p

    # Check for auth error simulation
    if [ "${FAKE_CODEBUDDY_AUTH_ERROR}" = "1" ]; then
      echo '{"error": "authentication required", "code": "AUTH_REQUIRED"}' >&2
      exit 1
    fi

    # Check for start failure simulation
    if [ "${FAKE_CODEBUDDY_START_FAIL}" = "1" ]; then
      echo "Failed to start" >&2
      exit 127
    fi

    # Default success output
    if [ "${FAKE_CODEBUDDY_OUTPUT}" = "json" ]; then
      cat << 'EOF'
{"sessionId": "fake-session-123", "summary": "Task completed successfully", "status": "success"}
EOF
    else
      echo "CodeBuddy fake execution completed"
      echo "Session ID: fake-session-123"
    fi
    exit 0
    ;;

  *)
    # Default help output
    echo "Usage: codebuddy [options] <command>"
    echo ""
    echo "Commands:"
    echo "  run       Run a task"
    echo "  continue  Continue a session"
    echo ""
    echo "Options:"
    echo "  --version     Show version"
    echo "  -p            Non-interactive mode"
    exit 0
    ;;
esac