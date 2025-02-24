
export class RetryHandler {
  private retries: Map<string, number> = new Map();
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY = 1000; // 1 second

  constructor() {}

  shouldRetry(key: string): boolean {
    const attempts = this.retries.get(key) || 0;
    return attempts < this.MAX_RETRIES;
  }

  async executeWithRetry<T>(
    key: string,
    operation: () => Promise<T>,
    onRetry?: (attempt: number, delay: number) => void
  ): Promise<T> {
    try {
      const result = await operation();
      this.retries.delete(key);
      return result;
    } catch (error) {
      const attempts = (this.retries.get(key) || 0) + 1;
      this.retries.set(key, attempts);

      if (attempts >= this.MAX_RETRIES) {
        this.retries.delete(key);
        throw error;
      }

      const delay = this.calculateDelay(attempts);
      if (onRetry) {
        onRetry(attempts, delay);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.executeWithRetry(key, operation, onRetry);
    }
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = this.BASE_DELAY * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 10000); // Cap at 10 seconds
  }

  reset(key?: string): void {
    if (key) {
      this.retries.delete(key);
    } else {
      this.retries.clear();
    }
  }

  getAttempts(key: string): number {
    return this.retries.get(key) || 0;
  }
}
