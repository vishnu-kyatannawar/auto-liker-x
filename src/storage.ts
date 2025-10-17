import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), 'processed-posts.json');

interface StorageData {
  processedPosts: Set<string>;
}

class Storage {
  private processedPosts: Set<string>;

  constructor() {
    this.processedPosts = new Set();
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
        this.processedPosts = new Set(data.processedPosts || []);
        console.log(`Loaded ${this.processedPosts.size} processed posts from storage`);
      }
    } catch (error) {
      console.error('Error loading storage:', error);
      this.processedPosts = new Set();
    }
  }

  private save(): void {
    try {
      const data = {
        processedPosts: Array.from(this.processedPosts),
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving storage:', error);
    }
  }

  isProcessed(postId: string): boolean {
    return this.processedPosts.has(postId);
  }

  markAsProcessed(postId: string): void {
    this.processedPosts.add(postId);
    this.save();
  }

  getProcessedCount(): number {
    return this.processedPosts.size;
  }
}

export default new Storage();
