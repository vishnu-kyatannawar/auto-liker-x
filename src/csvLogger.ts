import fs from 'fs';
import path from 'path';

export interface RunResult {
  timestamp: string;
  platform: 'LinkedIn' | 'Instagram';
  page: string;
  newPostsFound: number;
  successfulLikes: number;
  failedPosts: number;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'PARTIAL';
  errorMessage?: string;
}

class CSVLogger {
  private csvPath: string;

  constructor(csvPath?: string) {
    this.csvPath = csvPath || path.join(process.cwd(), 'bot-results.csv');
    this.ensureCSVExists();
  }

  private ensureCSVExists(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.csvPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }

      // Create CSV with headers if it doesn't exist
      if (!fs.existsSync(this.csvPath)) {
        const headers = 'Timestamp (IST),Platform,Page,New Posts Found,Successfully Liked,Failed/Skipped,Status,Error Message\n';
        fs.writeFileSync(this.csvPath, headers);
        console.log(`Created CSV log file: ${this.csvPath}`);
      }
    } catch (error) {
      console.error('Error ensuring CSV exists:', error);
    }
  }

  private getISTTimestamp(): string {
    // Convert to IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const istTime = new Date(now.getTime() + istOffset);

    // Format: YYYY-MM-DD HH:MM:SS
    return istTime.toISOString().replace('T', ' ').substring(0, 19);
  }

  private escapeCSV(value: string): string {
    // Escape quotes and wrap in quotes if contains comma or newline
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  logResult(result: RunResult): void {
    try {
      const timestamp = this.getISTTimestamp();
      const errorMsg = result.errorMessage ? this.escapeCSV(result.errorMessage) : '';

      const row = [
        timestamp,
        result.platform,
        this.escapeCSV(result.page),
        result.newPostsFound,
        result.successfulLikes,
        result.failedPosts,
        result.status,
        errorMsg
      ].join(',') + '\n';

      fs.appendFileSync(this.csvPath, row);
      console.log(`✓ Logged result to CSV: ${this.csvPath}`);
    } catch (error) {
      console.error('Error writing to CSV:', error);
    }
  }

  getLogPath(): string {
    return this.csvPath;
  }
}

export default CSVLogger;
