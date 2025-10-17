import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import storage from './storage';

export class LinkedInBot {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private email: string;
  private password: string;
  private headless: boolean;
  private userDataDir: string;

  constructor(email: string, password: string, headless: boolean = false, userDataDir?: string) {
    this.email = email;
    this.password = password;
    this.headless = headless;
    this.userDataDir = userDataDir || path.join(process.cwd(), '.browser-data');
  }

  async initialize(): Promise<void> {
    console.log('Launching browser with persistent context...');

    // Launch browser with persistent context to save session
    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: this.headless,
      slowMo: this.headless ? 0 : 100,
    });

    this.browser = this.context.browser()!;

    // Get or create a page
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

    await this.ensureLoggedIn();
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Checking login status...');

    try {
      // Try to go to feed page with a more lenient wait condition
      await this.page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait a bit for redirects
      await this.page.waitForTimeout(2000);

      const url = this.page.url();

      // If we're already logged in, the URL should contain /feed/
      if (url.includes('/feed/')) {
        console.log('Already logged in (session restored)');
        return;
      }

      // Otherwise, perform login
      console.log('Not logged in, performing login...');
      await this.page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

      // Fill in credentials
      await this.page.fill('#username', this.email);
      await this.page.fill('#password', this.password);
      await this.page.click('button[type="submit"]');

      // Wait for navigation to complete
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(3000);

      // Check if login was successful or needs verification
      const currentUrl = this.page.url();
      if (currentUrl.includes('/checkpoint/')) {
        console.log('\n⚠️  VERIFICATION REQUIRED ⚠️');
        console.log('Please complete the verification in the browser window.');
        console.log('Waiting for you to complete verification...\n');

        // Wait for user to complete verification (max 5 minutes)
        await this.page.waitForURL('**/feed/**', { timeout: 300000 });
        console.log('✓ Verification completed! Session saved for future runs.');
      } else if (currentUrl.includes('/login')) {
        throw new Error('Login failed. Please check credentials.');
      } else {
        console.log('Successfully logged in to LinkedIn');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Timeout')) {
        console.log('⚠️  Page load timeout - checking if already logged in...');
        const url = this.page.url();
        if (url.includes('/feed/')) {
          console.log('Already logged in (session restored)');
          return;
        }
      }
      throw error;
    }
  }

  async checkPageForNewPosts(pageUrl: string): Promise<number> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`\nChecking page: ${pageUrl}`);
    await this.page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for posts to load
    await this.page.waitForTimeout(3000);

    // Sort posts by Recent
    await this.sortByRecent();

    // TESTING: Stop here to verify sorting works
    console.log('\n✓ Testing mode: Stopped after sorting posts');
    console.log('Please verify the posts are sorted by Recent in the browser');
    console.log('Waiting for 60 seconds before closing...\n');
    await this.page.waitForTimeout(60000);
    return 0;

    // Scroll to load more posts
    await this.page.evaluate(() => window.scrollTo(0, 1000));
    await this.page.waitForTimeout(2000);

    // Find all post containers
    const posts = await this.page.$$('div[data-urn*="activity"]');
    console.log(`Found ${posts.length} posts on the page`);

    let newPostsProcessed = 0;

    for (const post of posts) {
      try {
        // Extract post URN (unique identifier)
        const urnAttribute = await post.getAttribute('data-urn');
        if (!urnAttribute) continue;

        const postId = urnAttribute;

        // Skip if already processed
        if (storage.isProcessed(postId)) {
          console.log(`Skipping already processed post: ${postId}`);
          continue;
        }

        console.log(`Processing new post: ${postId}`);

        // Like the post
        await this.likePost(post);

        // Reshare the post
        await this.resharePost(post);

        // Mark as processed
        storage.markAsProcessed(postId);
        newPostsProcessed++;

        // Add delay between actions to avoid rate limiting
        await this.page.waitForTimeout(2000);
      } catch (error) {
        console.error('Error processing post:', error);
      }
    }

    console.log(`Processed ${newPostsProcessed} new posts from ${pageUrl}`);
    return newPostsProcessed;
  }

  private async likePost(postElement: any): Promise<void> {
    try {
      // Find the like button within the post
      const likeButton = await postElement.$('button[aria-label*="Like"]');

      if (!likeButton) {
        console.log('Like button not found');
        return;
      }

      // Check if already liked
      const ariaPressed = await likeButton.getAttribute('aria-pressed');
      if (ariaPressed === 'true') {
        console.log('Post already liked');
        return;
      }

      await likeButton.click();
      console.log('✓ Liked post');
      await this.page?.waitForTimeout(1000);
    } catch (error) {
      console.error('Error liking post:', error);
    }
  }

  private async sortByRecent(): Promise<void> {
    if (!this.page) return;

    try {
      console.log('Sorting posts by Recent...');

      // Look for the sort dropdown button (usually says "Top" or "Recent")
      const sortButton = await this.page.$('button[aria-label*="Sort by"], button:has-text("Sort by")');

      if (!sortButton) {
        console.log('Sort button not found, posts may already be sorted or page structure changed');
        return;
      }

      // Click the sort button to open dropdown
      await sortButton.click();
      await this.page.waitForTimeout(1000);

      // Click on "Recent" option
      const recentOption = await this.page.$('div[role="menuitem"]:has-text("Recent"), button:has-text("Recent")');

      if (recentOption) {
        await recentOption.click();
        console.log('✓ Sorted by Recent');
        await this.page.waitForTimeout(2000); // Wait for posts to reload
      } else {
        console.log('Recent option not found in sort menu');
      }
    } catch (error) {
      console.log('Could not sort by recent (this is optional):', error);
    }
  }

  private async resharePost(postElement: any): Promise<void> {
    try {
      // Find the repost button
      const repostButton = await postElement.$('button[aria-label*="Repost"]');

      if (!repostButton) {
        console.log('Repost button not found');
        return;
      }

      await repostButton.click();
      await this.page?.waitForTimeout(1500);

      // Click on "Repost" option in the dropdown menu
      const repostOption = await this.page?.$('button[aria-label*="Repost"], div[role="button"]:has-text("Repost")');

      if (repostOption) {
        await repostOption.click();
        console.log('✓ Reshared post');
        await this.page?.waitForTimeout(1000);
      } else {
        console.log('Repost option not found in menu');
      }
    } catch (error) {
      console.error('Error resharing post:', error);
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      console.log('Browser closed');
    }
  }
}
