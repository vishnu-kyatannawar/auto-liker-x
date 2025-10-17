import { chromium, Browser, Page } from 'playwright';
import storage from './storage';

export class LinkedInBot {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private email: string;
  private password: string;

  constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
  }

  async initialize(): Promise<void> {
    console.log('Launching browser...');
    this.browser = await chromium.launch({
      headless: false, // Set to true for production
      slowMo: 100
    });
    this.page = await this.browser.newPage();
    await this.login();
  }

  private async login(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Logging in to LinkedIn...');
    await this.page.goto('https://www.linkedin.com/login');

    // Fill in credentials
    await this.page.fill('#username', this.email);
    await this.page.fill('#password', this.password);
    await this.page.click('button[type="submit"]');

    // Wait for navigation to complete
    await this.page.waitForLoadState('networkidle');

    // Check if login was successful
    const url = this.page.url();
    if (url.includes('/checkpoint/') || url.includes('/login')) {
      throw new Error('Login failed. Please check credentials or handle verification.');
    }

    console.log('Successfully logged in to LinkedIn');
  }

  async checkPageForNewPosts(pageUrl: string): Promise<number> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`\nChecking page: ${pageUrl}`);
    await this.page.goto(pageUrl, { waitUntil: 'networkidle' });

    // Wait for posts to load
    await this.page.waitForTimeout(3000);

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
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }
}
