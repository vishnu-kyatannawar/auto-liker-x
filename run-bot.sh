#!/bin/bash

# Wrapper script to run LinkedIn or Instagram bot with proper environment
# Usage: ./run-bot.sh [linkedin|instagram|both]
# Default: both (runs both bots sequentially)

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Parse argument (default to both)
BOT_TYPE="${1:-both}"

# Validate bot type
if [ "$BOT_TYPE" != "linkedin" ] && [ "$BOT_TYPE" != "instagram" ] && [ "$BOT_TYPE" != "both" ]; then
    echo "ERROR: Invalid bot type '$BOT_TYPE'"
    echo "Usage: $0 [linkedin|instagram|both]"
    exit 1
fi

# If both, run them sequentially
if [ "$BOT_TYPE" == "both" ]; then
    echo "=========================================="
    echo "Running Both Bots - Starting at $(date)"
    echo "=========================================="
    echo ""
    
    # Run LinkedIn bot
    "$0" linkedin
    LINKEDIN_EXIT=$?
    
    echo ""
    echo "=========================================="
    echo ""
    
    # Run Instagram bot
    "$0" instagram
    INSTAGRAM_EXIT=$?
    
    echo ""
    echo "=========================================="
    echo "Both Bots Completed at $(date)"
    echo "LinkedIn exit code: $LINKEDIN_EXIT"
    echo "Instagram exit code: $INSTAGRAM_EXIT"
    echo "=========================================="
    
    # Exit with error if either failed
    if [ $LINKEDIN_EXIT -ne 0 ] || [ $INSTAGRAM_EXIT -ne 0 ]; then
        exit 1
    fi
    exit 0
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
