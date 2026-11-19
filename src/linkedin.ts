import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { windowOptions } from './browserWindow';

const CLOUDFLARE_FIX = 'Run the bot once with HEADLESS=false and tick "Verify you are human".';
const SIGN_IN_FIX = 'Run the bot once with HEADLESS=false and sign in.';
const MAX_ERROR_SCREENSHOTS = 50;

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
      ...windowOptions(this.headless),
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
      // Probe the feed first: a valid session stays on /feed/, an expired one is
      // redirected away. /login is not used for this check because LinkedIn no
      // longer redirects logged-in sessions from it (it serves a Cloudflare page).
      await this.page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for page to load
      await this.page.waitForTimeout(2000);

      // A Cloudflare check keeps the /feed/ URL, so the URL alone can't prove a
      // working session (this is how the bot reported "logged in" while blocked).
      const blocked = await this.detectBlockPage(false);
      if (blocked) {
        const shot = await this.saveErrorScreenshot('feed');
        throw new Error(`${blocked}${shot ? ` Screenshot: ${shot}` : ''}`);
      }

      if (this.page.url().includes('/feed/')) {
        console.log('Already logged in (session restored)');
        return;
      }

      await this.page.goto('https://www.linkedin.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await this.page.waitForTimeout(2000);

      const title = await this.page.title();
      if (title.includes('Cloudflare') || title.includes('Attention Required')) {
        throw new Error('LinkedIn login page blocked by Cloudflare. Log in once with HEADLESS=false to refresh the session.');
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

      const blocked = await this.detectBlockPage();
      if (blocked) {
        const shot = await this.saveErrorScreenshot(pageUrl);
        result.status = 'ERROR';
        result.errorMessage = `${blocked}${shot ? ` Screenshot: ${shot}` : ''}`;
        console.error(`✗ ${result.errorMessage}`);
        return result;
      }

      // Sort posts by Recent
      await this.sortByRecent();

      // Scroll down to find the last liked post and get the URN
      const lastLikedPostUrn = await this.findLastLikedPostUrn();

      if (!lastLikedPostUrn) {
        console.log('No liked posts found, will process all posts');
      } else {
        console.log(`Found last liked post with URN: ${lastLikedPostUrn}`);
      }

      // Scroll back to top to get all posts fresh
      await this.page.evaluate(() => window.scrollTo(0, 0));
      await this.page.waitForTimeout(2000);

      // Scroll down a bit to load more posts
      await this.page.evaluate(() => window.scrollBy(0, 1500));
      await this.page.waitForTimeout(2000);
      await this.page.evaluate(() => window.scrollBy(0, 1500));
      await this.page.waitForTimeout(2000);

      // Get all posts
      const allPosts = await this.page.$$('div[data-urn*="activity"]');
      console.log(`Found ${allPosts.length} total posts on the page`);

      // The monitored pages always have posts, so none at all means the page
      // didn't render its feed (blocked, signed out, or a LinkedIn layout change).
      if (allPosts.length === 0) {
        const shot = await this.saveErrorScreenshot(pageUrl);
        result.status = 'ERROR';
        result.errorMessage = `No posts found on the page (title: "${await this.page.title()}"); ` +
          `LinkedIn blocked the page or changed its layout.${shot ? ` Screenshot: ${shot}` : ''}`;
        console.error(`✗ ${result.errorMessage}`);
        return result;
      }

      // Find the index of the last liked post in current DOM
      let lastLikedIndex = -1;
      if (lastLikedPostUrn) {
        for (let i = 0; i < allPosts.length; i++) {
          const urn = await allPosts[i].getAttribute('data-urn');
          if (urn === lastLikedPostUrn) {
            lastLikedIndex = i;
            console.log(`Last liked post is at index ${i} in current view`);
            break;
          }
        }
      }

      // Process only posts before the last liked one (newer posts)
      // Don't reverse - we want to process from top (newest) to the liked post (oldest new)
      const postsToProcess = lastLikedIndex === -1
        ? allPosts
        : allPosts.slice(0, lastLikedIndex);

      result.newPostsFound = postsToProcess.length;
      console.log(`Will process ${postsToProcess.length} new posts`);

      // Debug: print URNs of posts we'll process
      for (let i = 0; i < Math.min(3, postsToProcess.length); i++) {
        const debugUrn = await postsToProcess[i].getAttribute('data-urn');
        console.log(`  Post ${i}: ${debugUrn}`);
      }

      for (const post of postsToProcess) {
        try {
          // Extract post URN (unique identifier)
          const urnAttribute = await post.getAttribute('data-urn');
          if (!urnAttribute) {
            console.log('Skipping post with no URN');
            continue;
          }

          const postId = urnAttribute;

          console.log(`Processing post: ${postId}`);

          // Scroll the post into view
          await post.scrollIntoViewIfNeeded();
          await this.page.waitForTimeout(500);

          // Like the post (it will check if already liked and skip if needed)
          const liked = await this.likePost(post);

          if (liked) {
            result.successfulLikes++;
          } else {
            result.failedPosts++;
          }

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

  private async findLastLikedPostUrn(): Promise<string | null> {
    if (!this.page) return null;

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
                // Get the URN of this liked post
                const urn = await post.getAttribute('data-urn');
                if (urn) {
                  console.log(`✓ Found liked post at index ${i} (URN: ${urn})`);
                  // Scroll this post into view
                  await post.scrollIntoViewIfNeeded();
                  await this.page.waitForTimeout(1000);
                  return urn;
                }
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

      return null; // No liked post found
    } catch (error) {
      console.error('Error finding last liked post:', error);
      return null;
    }
  }

  // Returns a reason when LinkedIn served a bot check or a sign-in wall instead of
  // the requested page, else null.
  // includeSignIn=false during login, where a redirect to /login is expected and
  // handled by filling in the credentials.
  private async detectBlockPage(includeSignIn: boolean = true): Promise<string | null> {
    if (!this.page) return null;
    try {
      const url = this.page.url();
      if (includeSignIn && /\/(authwall|login|checkpoint|uas\/login)/.test(url)) {
        return `LinkedIn sent the bot to a sign-in page (${url}); the saved session is no longer valid. ${SIGN_IN_FIX}`;
      }
      const title = await this.page.title();
      const challengeFrame = await this.page.$('iframe[src*="challenges.cloudflare.com"]');
      const bodyText = await this.page.evaluate(() => document.body?.innerText?.slice(0, 2000) || '');
      if (
        /just a moment|attention required|cloudflare/i.test(title) ||
        challengeFrame ||
        /performing security verification|verify you are human/i.test(bodyText)
      ) {
        return `LinkedIn is showing a Cloudflare security check ("${title}") instead of the page. ${CLOUDFLARE_FIX}`;
      }
    } catch {
      // page mid-navigation: let the normal flow decide
    }
    return null;
  }

  // Saves what the browser shows for later review; keeps the newest few dozen.
  private async saveErrorScreenshot(label: string): Promise<string | null> {
    if (!this.page) return null;
    try {
      const dir = path.join(process.cwd(), 'error-screenshots');
      fs.mkdirSync(dir, { recursive: true });
      let name = label;
      try {
        name = new URL(label).pathname.split('/').filter(Boolean)[1] || label;
      } catch {
        // label is not a URL
      }
      const stamp = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const file = path.join(dir, `linkedin-${stamp}-${name.replace(/[^\w.-]/g, '_')}.png`);
      await this.page.screenshot({ path: file });
      const old = fs.readdirSync(dir).filter((f) => f.startsWith('linkedin-')).sort();
      for (const f of old.slice(0, Math.max(0, old.length - MAX_ERROR_SCREENSHOTS))) {
        fs.unlinkSync(path.join(dir, f));
      }
      return file;
    } catch (e) {
      console.log(`(screenshot failed: ${e instanceof Error ? e.message : 'unknown error'})`);
      return null;
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
