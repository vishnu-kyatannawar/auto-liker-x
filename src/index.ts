import dotenv from 'dotenv';
import { LinkedInBot } from './linkedin';

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

  // Get check interval and headless mode
  const intervalMinutes = parseInt(process.env.CHECK_INTERVAL_MINUTES || '60');
  const headless = process.env.HEADLESS === 'true';

  console.log('=== LinkedIn Post Liker & Resharer ===');
  console.log(`Monitoring ${pages.length} pages`);
  console.log(`Check interval: ${intervalMinutes} minutes`);
  console.log(`Headless mode: ${headless}\n`);

  // Run the bot
  await runBot(email, password, pages, headless);

  // Schedule recurring checks
  setInterval(async () => {
    console.log('\n--- Running scheduled check ---');
    await runBot(email, password, pages, headless);
  }, intervalMinutes * 60 * 1000);
}

async function runBot(email: string, password: string, pages: string[], headless: boolean) {
  const bot = new LinkedInBot(email, password, headless);

  try {
    await bot.initialize();

    let totalProcessed = 0;
    for (const pageUrl of pages) {
      const processed = await bot.checkPageForNewPosts(pageUrl);
      totalProcessed += processed;
    }

    console.log(`\n✓ Check complete. Processed ${totalProcessed} new posts total.`);
    console.log(`Next check in ${process.env.CHECK_INTERVAL_MINUTES || 60} minutes...\n`);
  } catch (error) {
    console.error('Error running bot:', error);
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
