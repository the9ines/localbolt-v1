
export class StateUpdateManager {
  private stateUpdateTimeout: NodeJS.Timeout | null = null;
  private readonly STATE_UPDATE_DELAY = 16; // ~1 frame @ 60fps

  debouncedStateUpdate(callback: () => void) {
    if (this.stateUpdateTimeout) {
      clearTimeout(this.stateUpdateTimeout);
    }

    this.stateUpdateTimeout = setTimeout(() => {
      callback();
      this.stateUpdateTimeout = null;
    }, this.STATE_UPDATE_DELAY);
  }

  clearTimeouts() {
    if (this.stateUpdateTimeout) {
      clearTimeout(this.stateUpdateTimeout);
      this.stateUpdateTimeout = null;
    }
  }
}
