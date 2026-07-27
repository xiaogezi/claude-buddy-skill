#!/bin/bash
# Fake CodeBuddy that simulates authentication required
echo '{"error": "authentication required"}' >&2
exit 1