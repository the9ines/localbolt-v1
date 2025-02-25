
export class StateUpdateManager {
  private stateUpdateTimeout: NodeJS.Timeout | null = null;
  private readonly STATE_UPDATE_DELAY = 16;
  private lastProgressUpdate: number = 0;
  private readonly PROGRESS_UPDATE_THRESHOLD = 50;
  private isCleaningUp: boolean = false;

  shouldUpdateProgress(): boolean {
    const now = Date.now();
    if (now - this.lastProgressUpdate < this.PROGRESS_UPDATE_THRESHOLD) {
      return false;
    }
    this.lastProgressUpdate = now;
    return true;
  }

  debounceUpdate(callback: () => void): void {
    if (this.stateUpdateTimeout) {
      clearTimeout(this.stateUpdateTimeout);
    }

    this.stateUpdateTimeout = setTimeout(() => {
      if (!this.isCleaningUp) {
        callback();
      }
      this.stateUpdateTimeout = null;
    }, this.STATE_UPDATE_DELAY);
  }

  cleanup(): void {
    this.isCleaningUp = true;
    if (this.stateUpdateTimeout) {
      clearTimeout(this.stateUpdateTimeout);
      this.stateUpdateTimeout = null;
    }
  }

  reset(): void {
    this.isCleaningUp = false;
    this.lastProgressUpdate = 0;
  }

  isProcessingCleanup(): boolean {
    return this.isCleaningUp;
  }
}
