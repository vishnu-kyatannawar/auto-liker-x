import dotenv from 'dotenv';
import { LinkedInBot } from './linkedin';
import CSVLogger from './csvLogger';

dotenv.config();

async function main() {
  // Validate environment variables
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  const pagesEnv = process.env.LINKEDIN_PAGES;

  if (!email || !password) {
    console.error('Error: LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in .env file');
    process.exit(1);
  }

  if (!pagesEnv) {
    console.error('Error: LINKEDIN_PAGES must be set in .env file');
    console.error('Example: LINKEDIN_PAGES=https://www.linkedin.com/company/example/,https://www.linkedin.com/in/person/');
    process.exit(1);
  }

  // Parse pages from comma-separated list
  const pages = pagesEnv.split(',').map(p => p.trim()).filter(p => p.length > 0);

  if (pages.length === 0) {
    console.error('Error: No valid LinkedIn pages found in LINKEDIN_PAGES');
    process.exit(1);
  }

  // Get configuration
  const intervalMinutes = parseInt(process.env.CHECK_INTERVAL_MINUTES || '60');
  const headless = process.env.HEADLESS === 'true';
  const runOnce = process.env.RUN_ONCE === 'true';

  // Initialize CSV logger
  const csvLogger = new CSVLogger(process.env.CSV_LOG_PATH);
  console.log(`CSV log file: ${csvLogger.getLogPath()}`);

  console.log('=== LinkedIn Post Liker ===');
  console.log(`Monitoring ${pages.length} pages`);
  console.log(`Headless mode: ${headless}`);
  console.log(`Run mode: ${runOnce ? 'Single run (exit after completion)' : `Continuous (every ${intervalMinutes} minutes)`}\n`);

  // Run the bot
  await runBot(email, password, pages, headless, csvLogger);

  // If RUN_ONCE is true, exit after first run
  if (runOnce) {
    console.log('✓ Single run completed. Exiting...');
    process.exit(0);
  }

  // Otherwise, schedule recurring checks
  console.log(`Next check in ${intervalMinutes} minutes...`);
  setInterval(async () => {
    console.log('\n--- Running scheduled check ---');
    await runBot(email, password, pages, headless, csvLogger);
  }, intervalMinutes * 60 * 1000);
}

async function runBot(email: string, password: string, pages: string[], headless: boolean, csvLogger: CSVLogger) {
  const bot = new LinkedInBot(email, password, headless);

  try {
    await bot.initialize();

    for (const pageUrl of pages) {
      const result = await bot.checkPageForNewPosts(pageUrl);

      // Log to CSV
      csvLogger.logResult({
        timestamp: '', // Will be set by CSVLogger
        platform: 'LinkedIn',
        page: result.page,
        newPostsFound: result.newPostsFound,
        successfulLikes: result.successfulLikes,
        failedPosts: result.failedPosts,
        status: result.status,
        errorMessage: result.errorMessage
      });
    }

    console.log(`\n✓ All pages checked. Results logged to CSV.`);
    console.log(`Next check in ${process.env.CHECK_INTERVAL_MINUTES || 60} minutes...\n`);
  } catch (error) {
    console.error('Error running bot:', error);

    // Log error to CSV
    csvLogger.logResult({
      timestamp: '',
      platform: 'LinkedIn',
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
