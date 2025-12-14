#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="20.18.0"
APPIMAGETOOL_VERSION="continuous"
BOT_TYPE="${1:-linkedin}"

if [ "$BOT_TYPE" != "linkedin" ] && [ "$BOT_TYPE" != "instagram" ]; then
    echo -e "${RED}Error: BOT_TYPE must be 'linkedin' or 'instagram'${NC}"
    exit 1
fi

echo -e "${GREEN}Building AppImage for ${BOT_TYPE} bot...${NC}"

# Create build directory
BUILD_DIR="build-appimage-${BOT_TYPE}"
APP_DIR="AppDir-${BOT_TYPE}"

# Clean previous builds
rm -rf "$BUILD_DIR" "$APP_DIR"
mkdir -p "$BUILD_DIR"

# Download Node.js if not exists
NODE_TAR="node-v${NODE_VERSION}-linux-x64.tar.xz"
NODE_DIR="node-v${NODE_VERSION}-linux-x64"
if [ ! -f "$BUILD_DIR/$NODE_TAR" ]; then
    echo -e "${YELLOW}Downloading Node.js ${NODE_VERSION}...${NC}"
    wget -q "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TAR}" -O "$BUILD_DIR/$NODE_TAR"
fi

# Extract Node.js
if [ ! -d "$BUILD_DIR/$NODE_DIR" ]; then
    echo -e "${YELLOW}Extracting Node.js...${NC}"
    tar -xf "$BUILD_DIR/$NODE_TAR" -C "$BUILD_DIR"
fi

# Download appimagetool if not exists
APPIMAGETOOL="appimagetool-x86_64.AppImage"
if [ ! -f "$BUILD_DIR/$APPIMAGETOOL" ]; then
    echo -e "${YELLOW}Downloading appimagetool...${NC}"
    wget -q "https://github.com/AppImage/AppImageKit/releases/download/${APPIMAGETOOL_VERSION}/${APPIMAGETOOL}" -O "$BUILD_DIR/$APPIMAGETOOL"
    chmod +x "$BUILD_DIR/$APPIMAGETOOL"
fi

# Create AppDir structure
echo -e "${YELLOW}Creating AppDir structure...${NC}"
mkdir -p "$APP_DIR/usr/bin"
mkdir -p "$APP_DIR/usr/lib"
mkdir -p "$APP_DIR/usr/share"

# Copy Node.js
echo -e "${YELLOW}Copying Node.js runtime...${NC}"
cp -r "$BUILD_DIR/$NODE_DIR/bin/node" "$APP_DIR/usr/bin/"
cp -r "$BUILD_DIR/$NODE_DIR/lib/node_modules" "$APP_DIR/usr/lib/" || true

# Install dependencies in a temporary directory
TEMP_NODE_MODULES="temp-node-modules-${BOT_TYPE}"
rm -rf "$TEMP_NODE_MODULES"
mkdir -p "$TEMP_NODE_MODULES"

echo -e "${YELLOW}Installing npm dependencies...${NC}"
cp package.json package-lock.json "$TEMP_NODE_MODULES/"
cd "$TEMP_NODE_MODULES"
npm install --production --no-audit --no-fund
cd ..

# Copy node_modules
echo -e "${YELLOW}Copying node_modules...${NC}"
cp -r "$TEMP_NODE_MODULES/node_modules" "$APP_DIR/usr/lib/"

# Build TypeScript
echo -e "${YELLOW}Building TypeScript...${NC}"
npm run build

# Copy compiled JavaScript and source files needed at runtime
echo -e "${YELLOW}Copying application files...${NC}"
mkdir -p "$APP_DIR/usr/lib/app"
cp -r dist "$APP_DIR/usr/lib/app/"
cp -r src "$APP_DIR/usr/lib/app/"  # Some files might be needed at runtime

# Install Playwright browsers
echo -e "${YELLOW}Installing Playwright browsers...${NC}"
PLAYWRIGHT_BROWSERS_DIR="$(pwd)/$TEMP_NODE_MODULES/playwright-browsers"
mkdir -p "$PLAYWRIGHT_BROWSERS_DIR"
cd "$TEMP_NODE_MODULES"
export PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_DIR"
npx playwright install chromium || true
cd ..

# Copy Playwright browsers to AppDir
echo -e "${YELLOW}Copying Playwright browsers...${NC}"
mkdir -p "$APP_DIR/usr/share/playwright/.local-browsers"
if [ -d "$PLAYWRIGHT_BROWSERS_DIR" ] && [ "$(ls -A "$PLAYWRIGHT_BROWSERS_DIR" 2>/dev/null)" ]; then
    # Copy from custom location
    cp -r "$PLAYWRIGHT_BROWSERS_DIR"/* "$APP_DIR/usr/share/playwright/.local-browsers/" 2>/dev/null || true
fi
if [ -d "$TEMP_NODE_MODULES/node_modules/playwright/.local-browsers" ]; then
    # Also try copying from node_modules location (backup)
    cp -r "$TEMP_NODE_MODULES/node_modules/playwright/.local-browsers"/* "$APP_DIR/usr/share/playwright/.local-browsers/" 2>/dev/null || true
fi

# Verify browsers were copied
if [ ! "$(ls -A "$APP_DIR/usr/share/playwright/.local-browsers" 2>/dev/null)" ]; then
    echo -e "${YELLOW}Warning: Playwright browsers directory is empty. Browsers may need to be installed manually.${NC}"
fi

# Create AppRun script
echo -e "${YELLOW}Creating AppRun script...${NC}"
if [ "$BOT_TYPE" = "linkedin" ]; then
    cat > "$APP_DIR/AppRun" << 'APPRUN_EOF'
#!/bin/bash
# Get the directory where the AppImage is mounted
# AppImage sets APPDIR when running, otherwise use script location
HERE="${APPDIR:-$(dirname "$(readlink -f "${0}")")}"

# Set up environment
export PATH="$HERE/usr/bin:$PATH"
export NODE_PATH="$HERE/usr/lib/node_modules"
export PLAYWRIGHT_BROWSERS_PATH="$HERE/usr/share/playwright/.local-browsers"

# Preserve the current working directory where the AppImage was executed
# This allows .env to be read from the current directory
# AppImage preserves the original working directory, so we don't need to change it
# The dotenv package in the Node.js app will read .env from process.cwd()

# Run the LinkedIn bot
exec "$HERE/usr/bin/node" "$HERE/usr/lib/app/dist/index.js"
APPRUN_EOF
else
    cat > "$APP_DIR/AppRun" << 'APPRUN_EOF'
#!/bin/bash
# Get the directory where the AppImage is mounted
# AppImage sets APPDIR when running, otherwise use script location
HERE="${APPDIR:-$(dirname "$(readlink -f "${0}")")}"

# Set up environment
export PATH="$HERE/usr/bin:$PATH"
export NODE_PATH="$HERE/usr/lib/node_modules"
export PLAYWRIGHT_BROWSERS_PATH="$HERE/usr/share/playwright/.local-browsers"

# Preserve the current working directory where the AppImage was executed
# This allows .env to be read from the current directory
# AppImage preserves the original working directory, so we don't need to change it
# The dotenv package in the Node.js app will read .env from process.cwd()

# Run the Instagram bot
exec "$HERE/usr/bin/node" "$HERE/usr/lib/app/dist/index-instagram.js"
APPRUN_EOF
fi

chmod +x "$APP_DIR/AppRun"

# Create desktop entry
echo -e "${YELLOW}Creating desktop entry...${NC}"
if [ "$BOT_TYPE" = "linkedin" ]; then
    cat > "$APP_DIR/app.desktop" << 'DESKTOP_EOF'
[Desktop Entry]
Name=LinkedIn Bot
Comment=Automated LinkedIn post liker
Exec=linkedin-bot.AppImage
Type=Application
Categories=Utility;
DESKTOP_EOF
else
    cat > "$APP_DIR/app.desktop" << 'DESKTOP_EOF'
[Desktop Entry]
Name=Instagram Bot
Comment=Automated Instagram post liker
Exec=instagram-bot.AppImage
Type=Application
Categories=Utility;
DESKTOP_EOF
fi

# Create .env.example
echo -e "${YELLOW}Creating .env.example...${NC}"
if [ "$BOT_TYPE" = "linkedin" ]; then
    cat > "$APP_DIR/.env.example" << 'ENV_EOF'
# LinkedIn Configuration
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password
LINKEDIN_PAGES=https://www.linkedin.com/company/your-company/,https://www.linkedin.com/in/some-person/

# General Configuration
CHECK_INTERVAL_MINUTES=60
HEADLESS=false
RUN_ONCE=false
CSV_LOG_PATH=./bot-results.csv
ENV_EOF
else
    cat > "$APP_DIR/.env.example" << 'ENV_EOF'
# Instagram Configuration
INSTAGRAM_USERNAME=your-username
INSTAGRAM_PASSWORD=your-password
INSTAGRAM_ACCOUNTS=https://www.instagram.com/account1/,https://www.instagram.com/account2/

# General Configuration
CHECK_INTERVAL_MINUTES=60
HEADLESS=false
RUN_ONCE=false
CSV_LOG_PATH=./bot-results.csv
ENV_EOF
fi

# Create icon if it doesn't exist (required by appimagetool)
ICON_NAME="${BOT_TYPE}-bot.png"
if [ ! -f "$APP_DIR/$ICON_NAME" ]; then
    echo -e "${YELLOW}Creating placeholder icon...${NC}"
    # Create a minimal 1x1 transparent PNG
    printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82' > "$APP_DIR/$ICON_NAME"
fi

# Update desktop file to include icon reference
if [ "$BOT_TYPE" = "linkedin" ]; then
    if ! grep -q "^Icon=" "$APP_DIR/app.desktop"; then
        sed -i '/^Type=Application/a Icon=linkedin-bot' "$APP_DIR/app.desktop"
    fi
else
    if ! grep -q "^Icon=" "$APP_DIR/app.desktop"; then
        sed -i '/^Type=Application/a Icon=instagram-bot' "$APP_DIR/app.desktop"
    fi
fi

# Build AppImage
OUTPUT_NAME="${BOT_TYPE}-bot.AppImage"
echo -e "${YELLOW}Building AppImage...${NC}"
ARCH=x86_64 "$BUILD_DIR/$APPIMAGETOOL" "$APP_DIR" "$OUTPUT_NAME"

if [ -f "$OUTPUT_NAME" ]; then
    echo -e "${GREEN}✓ AppImage built successfully: ${OUTPUT_NAME}${NC}"
    echo -e "${GREEN}Size: $(du -h "$OUTPUT_NAME" | cut -f1)${NC}"
    
    # Cleanup all temporary files and directories, keep only the AppImage
    echo -e "${YELLOW}Cleaning up temporary files...${NC}"
    rm -rf "$TEMP_NODE_MODULES"
    rm -rf "$BUILD_DIR"
    rm -rf "$APP_DIR"
    
    echo -e "${GREEN}✓ Cleanup complete. Only ${OUTPUT_NAME} remains.${NC}"
else
    echo -e "${RED}✗ AppImage build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}Done!${NC}"

