#!/bin/bash

# Wrapper script to run LinkedIn bot with proper environment

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Log start time
echo "=========================================="
echo "LinkedIn Bot - Starting at $(date)"
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
echo ""

# Run npm start
npm start

# Log completion
echo ""
echo "=========================================="
echo "LinkedIn Bot - Completed at $(date)"
echo "=========================================="
