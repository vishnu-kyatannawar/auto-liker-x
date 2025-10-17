import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import storage from './storage';

export interface PageResult {
  page: string;
  newPostsFound: number;
  successfulLikes: number;
  failedPosts: number;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'PARTIAL';
  errorMessage?: string;
}

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
      viewport: { width: 1920, height: 1080 },
    });

    this.browser = this.context.browser()!;

    // Get or create a page
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

    await this.ensureLoggedIn();
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Performing login...');

    try {
      // Always go to login page
      await this.page.goto('https://www.linkedin.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for page to load
      await this.page.waitForTimeout(2000);

      // Check if already logged in (LinkedIn might redirect to feed)
      const currentUrl = this.page.url();
      if (currentUrl.includes('/feed/')) {
        console.log('Already logged in (session restored)');
        return;
      }

      // Fill in credentials
      console.log('Filling in credentials...');
      await this.page.fill('#username', this.email);
      await this.page.fill('#password', this.password);
      await this.page.click('button[type="submit"]');

      // Wait for navigation to complete
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(3000);

      // Check if login was successful or needs verification
      const postLoginUrl = this.page.url();
      if (postLoginUrl.includes('/checkpoint/')) {
        console.log('\n⚠️  VERIFICATION REQUIRED ⚠️');
        console.log('Please complete the verification in the browser window.');
        console.log('Waiting for you to complete verification...\n');

        // Wait for user to complete verification (max 5 minutes)
        await this.page.waitForURL('**/feed/**', { timeout: 300000 });
        console.log('✓ Verification completed! Session saved for future runs.');
      } else if (postLoginUrl.includes('/login')) {
        throw new Error('Login failed. Please check credentials.');
      } else if (postLoginUrl.includes('/feed/')) {
        console.log('Successfully logged in to LinkedIn');
      } else {
        console.log('Login completed, navigated to:', postLoginUrl);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Timeout')) {
        console.log('⚠️  Page load timeout - checking current status...');
        const url = this.page.url();
        if (url.includes('/feed/')) {
          console.log('Already logged in (session restored)');
          return;
        }
      }
      throw error;
    }
  }

  async checkPageForNewPosts(pageUrl: string): Promise<PageResult> {
    const result: PageResult = {
      page: pageUrl,
      newPostsFound: 0,
      successfulLikes: 0,
      failedPosts: 0,
      status: 'SUCCESS'
    };

    try {
      if (!this.page) throw new Error('Page not initialized');

      console.log(`\nChecking page: ${pageUrl}`);

      try {
        await this.page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      } catch (error) {
        result.status = 'TIMEOUT';
        result.errorMessage = `Page load timeout: ${error instanceof Error ? error.message : 'Unknown error'}`;
        return result;
      }

      // Wait for posts to load
      await this.page.waitForTimeout(3000);

      // Sort posts by Recent
      await this.sortByRecent();

      // Scroll down to find the last liked post
      const lastLikedPostIndex = await this.findLastLikedPost();

      if (lastLikedPostIndex === -1) {
        console.log('No liked posts found, will process all posts');
      } else {
        console.log(`Found last liked post at index ${lastLikedPostIndex}`);
      }

      // Get all posts
      const allPosts = await this.page.$$('div[data-urn*="activity"]');
      console.log(`Found ${allPosts.length} total posts on the page`);

      // Process only posts after the last liked one (newer posts)
      const postsToProcess = lastLikedPostIndex === -1
        ? allPosts
        : allPosts.slice(0, lastLikedPostIndex).reverse(); // Reverse to go from oldest to newest

      result.newPostsFound = postsToProcess.length;
      console.log(`Will process ${postsToProcess.length} new posts (from oldest to newest)`);

      for (const post of postsToProcess) {
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

          // Scroll the post into view
          await post.scrollIntoViewIfNeeded();
          await this.page.waitForTimeout(500);

          // Like the post
          const liked = await this.likePost(post);

          if (liked) {
            result.successfulLikes++;
          } else {
            result.failedPosts++;
          }

          // Mark as processed
          storage.markAsProcessed(postId);

          // Add delay between actions to avoid rate limiting
          await this.page.waitForTimeout(2000);
        } catch (error) {
          console.error('Error processing post:', error);
          result.failedPosts++;
        }
      }

      // Determine final status
      if (result.failedPosts > 0 && result.successfulLikes === 0) {
        result.status = 'ERROR';
      } else if (result.failedPosts > 0) {
        result.status = 'PARTIAL';
      }

      // Log summary
      console.log('\n=== SUMMARY ===');
      console.log(`✓ Process completed: ${result.status}`);
      console.log(`New posts found: ${result.newPostsFound}`);
      console.log(`Successfully liked: ${result.successfulLikes}`);
      console.log(`Failed/Skipped: ${result.failedPosts}`);
      console.log(`Page: ${pageUrl}`);
      console.log('===============\n');

      return result;
    } catch (error) {
      result.status = 'ERROR';
      result.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking page:', error);
      return result;
    }
  }

  private async likePost(postElement: any): Promise<boolean> {
    try {
      // Find the like button within the post
      const likeButton = await postElement.$('button[aria-label*="Like"]');

      if (!likeButton) {
        console.log('❌ Like button not found');
        return false;
      }

      // Check if already liked
      const ariaPressed = await likeButton.getAttribute('aria-pressed');
      if (ariaPressed === 'true') {
        console.log('⚠️  Post already liked');
        return false;
      }

      await likeButton.click();
      console.log('✓ Liked post');
      await this.page?.waitForTimeout(1000);
      return true;
    } catch (error) {
      console.error('❌ Error liking post:', error);
      return false;
    }
  }

  private async findLastLikedPost(): Promise<number> {
    if (!this.page) return -1;

    try {
      console.log('Scrolling to find last liked post...');

      // Scroll to top first
      await this.page.evaluate(() => window.scrollTo(0, 0));
      await this.page.waitForTimeout(1000);

      let previousPostCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 50; // Increased to allow more scrolling

      while (scrollAttempts < maxScrollAttempts) {
        // Get all posts currently loaded
        const posts = await this.page.$$('div[data-urn*="activity"]');
        const currentPostCount = posts.length;

        console.log(`Checking ${currentPostCount} posts... (scroll attempt ${scrollAttempts + 1})`);

        // Check each post for like status
        for (let i = 0; i < posts.length; i++) {
          const post = posts[i];
          try {
            const likeButton = await post.$('button[aria-label*="Like"]');

            if (likeButton) {
              const ariaPressed = await likeButton.getAttribute('aria-pressed');
              if (ariaPressed === 'true') {
                console.log(`✓ Found liked post at index ${i} (total ${currentPostCount} posts loaded)`);
                // Scroll this post into view
                await post.scrollIntoViewIfNeeded();
                await this.page.waitForTimeout(1000);
                return i;
              }
            }
          } catch (e) {
            // Skip posts that cause errors
            continue;
          }
        }

        // Check if we've loaded new posts
        if (currentPostCount === previousPostCount) {
          console.log(`No new posts loaded after scrolling (still at ${currentPostCount} posts)`);
          console.log('⚠️  Reached end of available posts, no liked posts found');
          break;
        }

        previousPostCount = currentPostCount;

        // Scroll down to load more posts
        await this.page.evaluate(() => window.scrollBy(0, 1500));
        await this.page.waitForTimeout(3000); // Increased wait time to allow posts to load
        scrollAttempts++;
      }

      if (scrollAttempts >= maxScrollAttempts) {
        console.log('⚠️  Reached maximum scroll attempts, no liked posts found');
      }

      return -1; // No liked post found
    } catch (error) {
      console.error('Error finding last liked post:', error);
      return -1;
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

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      console.log('Browser closed');
    }
  }
}
