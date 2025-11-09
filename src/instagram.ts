import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';

export interface PageResult {
  page: string;
  newPostsFound: number;
  successfulLikes: number;
  failedPosts: number;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'PARTIAL';
  errorMessage?: string;
}

export class InstagramBot {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private username: string;
  private password: string;
  private headless: boolean;
  private userDataDir: string;

  constructor(username: string, password: string, headless: boolean = false, userDataDir?: string) {
    this.username = username;
    this.password = password;
    this.headless = headless;
    this.userDataDir = userDataDir || path.join(process.cwd(), '.browser-data-instagram');
  }

  async initialize(): Promise<void> {
    console.log('Launching browser with persistent context...');

    // Launch browser with persistent context to save session
    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: this.headless,
      slowMo: this.headless ? 0 : 100,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.browser = this.context.browser()!;

    // Get or create a page
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

    await this.ensureLoggedIn();
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Checking Instagram login status...');

    try {
      // Navigate to Instagram
      await this.page.goto('https://www.instagram.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for page to load
      await this.page.waitForTimeout(3000);

      // Check if already logged in by looking for the search bar or profile icon
      const isLoggedIn = await this.page.$('svg[aria-label="Search"]') || 
                         await this.page.$('svg[aria-label="Home"]') ||
                         await this.page.$('a[href*="/direct/inbox/"]');

      if (isLoggedIn) {
        console.log('Already logged in (session restored)');
        return;
      }

      console.log('Not logged in, proceeding with login...');

      // Go to login page
      await this.page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await this.page.waitForTimeout(2000);

      // Wait for login form
      await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });

      // Fill in credentials
      console.log('Filling in credentials...');
      await this.page.fill('input[name="username"]', this.username);
      await this.page.waitForTimeout(500);
      await this.page.fill('input[name="password"]', this.password);
      await this.page.waitForTimeout(500);

      // Click login button
      await this.page.click('button[type="submit"]');

      // Wait for navigation
      await this.page.waitForTimeout(5000);

      // Check current URL and handle various post-login scenarios
      const currentUrl = this.page.url();

      // Handle "Save Your Login Info" prompt
      if (currentUrl.includes('/accounts/onetap/')) {
        console.log('Handling "Save Login Info" prompt...');
        try {
          // Click "Save info" button to save the session
          const saveInfoButton = await this.page.$('button:has-text("Save info"), button:has-text("Save Info")');
          if (saveInfoButton) {
            await saveInfoButton.click();
            console.log('✓ Clicked "Save info" button');
            await this.page.waitForTimeout(2000);
          }
        } catch (e) {
          console.log('Could not find "Save info" button, continuing...');
        }
      }

      // Handle "Turn on Notifications" prompt
      try {
        const notificationsButton = await this.page.$('button:has-text("Not Now")');
        if (notificationsButton) {
          console.log('Handling notifications prompt...');
          await notificationsButton.click();
          await this.page.waitForTimeout(2000);
        }
      } catch (e) {
        // Ignore if not found
      }

      // Check if login was successful
      await this.page.waitForTimeout(3000);
      const finalUrl = this.page.url();

      if (finalUrl.includes('/challenge/') || finalUrl.includes('/two_factor')) {
        console.log('\n⚠️  VERIFICATION REQUIRED ⚠️');
        console.log('Please complete the verification in the browser window.');
        console.log('Waiting for you to complete verification...\n');

        // Wait for user to complete verification (max 5 minutes)
        // Instagram might redirect to onetap or home page
        try {
          await this.page.waitForURL(/\/(accounts\/onetap\/|$)/, { timeout: 300000 });
          console.log('✓ Verification completed!');
        } catch (e) {
          console.log('Verification wait timeout, checking current page...');
        }
        
        await this.page.waitForTimeout(2000);
      } else if (finalUrl.includes('/accounts/login/')) {
        throw new Error('Login failed. Please check credentials.');
      } else {
        console.log('Successfully logged in to Instagram');
      }

      // Handle "Save Your Login Info" prompt after verification (appears at /accounts/onetap/)
      const postVerificationUrl = this.page.url();
      if (postVerificationUrl.includes('/accounts/onetap/')) {
        console.log('Handling "Save Login Info" prompt after verification...');
        try {
          const saveInfoButton = await this.page.$('button:has-text("Save info"), button:has-text("Save Info")');
          if (saveInfoButton) {
            await saveInfoButton.click();
            console.log('✓ Clicked "Save info" button');
            await this.page.waitForTimeout(2000);
          }
        } catch (e) {
          console.log('Could not find "Save info" button, continuing...');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Timeout')) {
        console.log('⚠️  Page load timeout - checking current status...');
        const url = this.page.url();
        if (!url.includes('/accounts/login/')) {
          console.log('Appears to be logged in despite timeout');
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

      console.log(`\nChecking Instagram page: ${pageUrl}`);

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

      // Wait for profile page to load
      console.log('Waiting for profile page to load...');
      await this.page.waitForTimeout(3000);

      // Find the first post link (looks for href pattern like /username/p/post_id/)
      console.log('Looking for first post...');
      const firstPostLink = await this.page.$('a[href*="/p/"]');
      
      if (!firstPostLink) {
        console.log('❌ No posts found on this profile');
        return result;
      }

      // Get the href for logging
      const firstPostHref = await firstPostLink.getAttribute('href');
      console.log(`✓ Found first post: ${firstPostHref}`);

      // Click on the first post
      console.log('Clicking on first post...');
      await firstPostLink.click();
      await this.page.waitForTimeout(3000);

      // PHASE 1: Navigate forward until we find 3 consecutive liked posts
      console.log('\n=== PHASE 1: Finding last liked post ===');
      let postsChecked = 0;
      const maxPostsToCheck = 50; // Safety limit
      let consecutiveLikedCount = 0;
      let foundLikedZone = false;

      while (postsChecked < maxPostsToCheck && !foundLikedZone) {
        // Get current post URL
        const currentUrl = this.page.url();
        console.log(`\nPost ${postsChecked + 1}: ${currentUrl}`);

        // Check if post is already liked
        const isLiked = await this.isPostLiked();

        if (isLiked) {
          consecutiveLikedCount++;
          console.log(`✓ This post is ALREADY LIKED (${consecutiveLikedCount}/3 consecutive)`);

          // If we found 3 consecutive liked posts, we've reached the "already processed" zone
          if (consecutiveLikedCount >= 3) {
            console.log('\n✓ Found 3 consecutive liked posts - this is where we left off!');
            foundLikedZone = true;
            result.newPostsFound = postsChecked - 2; // Subtract the 3 liked posts we just checked
            break;
          }

          // Continue to next post to check if it's also liked
          const nextButton = await this.page.$('button svg[aria-label="Next"]');
          if (!nextButton) {
            console.log('❌ No more posts (Next button not found)');
            break;
          }

          const nextButtonElement = await nextButton.evaluateHandle(svg => svg.closest('button'));
          await (nextButtonElement as any).click();
          console.log('Clicked "Next" button');
          await this.page.waitForTimeout(2000);
          postsChecked++;
        } else {
          consecutiveLikedCount = 0; // Reset counter if we find an unliked post
          console.log('✓ This post is NOT LIKED yet - continuing...');
          postsChecked++;

          // Click the "Next" button to go to next post
          const nextButton = await this.page.$('button svg[aria-label="Next"]');
          
          if (!nextButton) {
            console.log('❌ No "Next" button found - might be the last post');
            break;
          }

          const nextButtonElement = await nextButton.evaluateHandle(svg => svg.closest('button'));
          await (nextButtonElement as any).click();
          console.log('Clicked "Next" button');
          await this.page.waitForTimeout(2000);
        }
      }

      if (!foundLikedZone) {
        console.log('\n⚠️  Did not find 3 consecutive liked posts - will like all posts found');
        result.newPostsFound = postsChecked;
      }

      // PHASE 2: Go back and like all posts that are not liked
      console.log('\n=== PHASE 2: Going back and liking new posts ===');
      let postsLiked = 0;

      while (true) {
        // Click the "Go back" button
        const backButton = await this.page.$('button svg[aria-label="Go back"]');
        
        if (!backButton) {
          console.log('✓ No "Go back" button found - reached the newest post');
          break;
        }

        const backButtonElement = await backButton.evaluateHandle(svg => svg.closest('button'));
        await (backButtonElement as any).click();
        console.log('\nClicked "Go back" button');
        await this.page.waitForTimeout(2000);

        // Get current post URL
        const currentUrl = this.page.url();
        console.log(`Current post: ${currentUrl}`);

        // Check if this post is already liked
        const isLiked = await this.isPostLiked();

        if (isLiked) {
          console.log('⚠️  This post is already liked - skipping');
        } else {
          console.log('Liking this post...');
          const liked = await this.likePost();
          
          if (liked) {
            postsLiked++;
            result.successfulLikes++;
            console.log(`✓ Successfully liked (${postsLiked} total)`);
          } else {
            result.failedPosts++;
            console.log('❌ Failed to like');
          }
          
          await this.page.waitForTimeout(2000);
        }
      }

      // Log summary
      console.log('\n=== SUMMARY ===');
      console.log(`Page: ${pageUrl}`);
      console.log(`First post checked: ${firstPostHref}`);
      console.log(`New posts found: ${result.newPostsFound}`);
      console.log(`Successfully liked: ${result.successfulLikes}`);
      console.log(`Failed to like: ${result.failedPosts}`);
      console.log('===============\n');

      return result;
    } catch (error) {
      result.status = 'ERROR';
      result.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking page:', error);
      return result;
    }
  }

  private async isPostLiked(): Promise<boolean> {
    try {
      if (!this.page) return false;

      // Check if the post is already liked by looking for "Unlike" SVG
      const unlikeLabel = await this.page.$('svg[aria-label="Unlike"]');
      return unlikeLabel !== null;
    } catch (error) {
      console.error('Error checking if post is liked:', error);
      return false;
    }
  }

  private async likePost(): Promise<boolean> {
    try {
      if (!this.page) return false;

      // Check if already liked by looking for "Unlike" label
      const unlikeLabel = await this.page.$('svg[aria-label="Unlike"]');
      if (unlikeLabel) {
        console.log('⚠️  Post already liked');
        return false;
      }

      // Find the like SVG (the heart icon) and click it directly
      // Instagram's like functionality works when clicking the SVG itself
      const likeSvg = await this.page.$('svg[aria-label="Like"]');
      
      if (!likeSvg) {
        console.log('❌ Like button (SVG) not found');
        return false;
      }

      // Click the SVG - Instagram handles the like action on the SVG element
      await likeSvg.click();
      console.log('✓ Liked post');
      await this.page.waitForTimeout(1000);
      return true;
    } catch (error) {
      console.error('❌ Error liking post:', error);
      return false;
    }
  }

  private async findLastLikedPost(): Promise<string | null> {
    if (!this.page) return null;

    try {
      console.log('Navigating through posts to find last liked post...');

      let postsChecked = 0;
      const maxPostsToCheck = 50; // Safety limit

      while (postsChecked < maxPostsToCheck) {
        try {
          // Check if current post is liked
          const unlikeLabel = await this.page.$('svg[aria-label="Unlike"]');
          
          if (unlikeLabel) {
            // This post is liked! Get its URL
            const currentUrl = this.page.url();
            const postHref = currentUrl.match(/\/p\/[^\/]+\//)?.[0];
            
            if (postHref) {
              console.log(`✓ Found liked post: ${postHref}`);
              return postHref;
            }
          }

          // Navigate to next post
          const nextButton = await this.page.$('button[aria-label="Next"], a[aria-label="Next"]');
          
          if (!nextButton) {
            console.log('No more posts to check (reached end)');
            break;
          }

          await nextButton.click();
          await this.page.waitForTimeout(2000);
          postsChecked++;
        } catch (error) {
          console.log('Error checking post, stopping search:', error);
          break;
        }
      }

      console.log('⚠️  No liked posts found in recent posts');
      return null;
    } catch (error) {
      console.error('Error finding last liked post:', error);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      console.log('Browser closed');
    }
  }
}


