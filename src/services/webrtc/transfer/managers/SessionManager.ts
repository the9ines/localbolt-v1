
import { v4 as uuidv4 } from 'uuid';

export class SessionManager {
  private currentSessionId: string | null = null;

  generateNewSession(): string {
    this.currentSessionId = uuidv4();
    return this.currentSessionId;
  }

  getCurrentSession(): string | null {
    return this.currentSessionId;
  }

  clearSession(): void {
    this.currentSessionId = null;
  }

  isValidSession(sessionId?: string): boolean {
    if (!sessionId) return true; // Allow messages without session ID
    return sessionId === this.currentSessionId;
  }
}
