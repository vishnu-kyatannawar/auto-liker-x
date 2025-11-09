#!/bin/bash

# Wrapper script to run LinkedIn or Instagram bot with proper environment
# Usage: ./run-bot.sh [linkedin|instagram]
# Default: linkedin

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Parse argument (default to linkedin)
BOT_TYPE="${1:-linkedin}"

# Validate bot type
if [ "$BOT_TYPE" != "linkedin" ] && [ "$BOT_TYPE" != "instagram" ]; then
    echo "ERROR: Invalid bot type '$BOT_TYPE'"
    echo "Usage: $0 [linkedin|instagram]"
    exit 1
fi

# Set bot-specific variables
if [ "$BOT_TYPE" == "instagram" ]; then
    BOT_NAME="Instagram Bot"
    NPM_COMMAND="start:instagram"
else
    BOT_NAME="LinkedIn Bot"
    NPM_COMMAND="start"
fi

# Log start time
echo "=========================================="
echo "$BOT_NAME - Starting at $(date)"
echo "=========================================="

# Source nvm if it exists
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    echo "Loading nvm..."
    . "$NVM_DIR/nvm.sh"
fi

# Load user's bash profile for PATH and other env vars
if [ -f "$HOME/.bashrc" ]; then
    echo "Loading .bashrc..."
    . "$HOME/.bashrc"
fi

# Change to project directory
cd "$SCRIPT_DIR" || exit 1
echo "Working directory: $SCRIPT_DIR"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm not found in PATH"
    echo "PATH: $PATH"
    exit 1
fi

echo "Using npm: $(which npm)"
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Running: npm run $NPM_COMMAND"
echo ""

# Run the appropriate npm command
npm run "$NPM_COMMAND"

# Log completion
echo ""
echo "=========================================="
echo "$BOT_NAME - Completed at $(date)"
echo "=========================================="
