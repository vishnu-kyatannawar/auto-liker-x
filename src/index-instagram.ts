import dotenv from 'dotenv';
import { InstagramBot } from './instagram';
import CSVLogger from './csvLogger';

dotenv.config();

async function main() {
  // Validate environment variables
  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;
  const accountsEnv = process.env.INSTAGRAM_ACCOUNTS;

  if (!username || !password) {
    console.error('Error: INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD must be set in .env file');
    process.exit(1);
  }

  if (!accountsEnv) {
    console.error('Error: INSTAGRAM_ACCOUNTS must be set in .env file');
    console.error('Example: INSTAGRAM_ACCOUNTS=https://www.instagram.com/account1/,https://www.instagram.com/account2/');
    process.exit(1);
  }

  // Parse accounts from comma-separated list
  const accounts = accountsEnv.split(',').map(p => p.trim()).filter(p => p.length > 0);

  if (accounts.length === 0) {
    console.error('Error: No valid Instagram accounts found in INSTAGRAM_ACCOUNTS');
    process.exit(1);
  }

  // Get configuration
  const intervalMinutes = parseInt(process.env.CHECK_INTERVAL_MINUTES || '60');
  const headless = process.env.HEADLESS === 'true';
  const runOnce = process.env.RUN_ONCE === 'true';

  // Initialize CSV logger (use same CSV_LOG_PATH as LinkedIn)
  const csvLogger = new CSVLogger(process.env.CSV_LOG_PATH);
  console.log(`CSV log file: ${csvLogger.getLogPath()}`);

  console.log('=== Instagram Post Liker ===');
  console.log(`Monitoring ${accounts.length} accounts`);
  console.log(`Headless mode: ${headless}`);
  console.log(`Run mode: ${runOnce ? 'Single run (exit after completion)' : `Continuous (every ${intervalMinutes} minutes)`}\n`);

  // Run the bot
  await runBot(username, password, accounts, headless, csvLogger);

  // If RUN_ONCE is true, exit after first run
  if (runOnce) {
    console.log('✓ Single run completed. Exiting...');
    process.exit(0);
  }

  // Otherwise, schedule recurring checks
  console.log(`Next check in ${intervalMinutes} minutes...`);
  setInterval(async () => {
    console.log('\n--- Running scheduled check ---');
    await runBot(username, password, accounts, headless, csvLogger);
  }, intervalMinutes * 60 * 1000);
}

async function runBot(username: string, password: string, accounts: string[], headless: boolean, csvLogger: CSVLogger) {
  const bot = new InstagramBot(username, password, headless);

  try {
    await bot.initialize();

    for (const accountUrl of accounts) {
      const result = await bot.checkPageForNewPosts(accountUrl);

      // Log to CSV
      csvLogger.logResult({
        timestamp: '', // Will be set by CSVLogger
        platform: 'Instagram',
        page: result.page,
        newPostsFound: result.newPostsFound,
        successfulLikes: result.successfulLikes,
        failedPosts: result.failedPosts,
        status: result.status,
        errorMessage: result.errorMessage
      });
    }

    console.log(`\n✓ All accounts checked. Results logged to CSV.`);
    console.log(`Next check in ${process.env.CHECK_INTERVAL_MINUTES || 60} minutes...\n`);
  } catch (error) {
    console.error('Error running bot:', error);

    // Log error to CSV
    csvLogger.logResult({
      timestamp: '',
      platform: 'Instagram',
      page: 'ALL',
      newPostsFound: 0,
      successfulLikes: 0,
      failedPosts: 0,
      status: 'ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await bot.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

main().catch(console.error);


