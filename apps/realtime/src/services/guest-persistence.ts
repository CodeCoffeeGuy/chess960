import { getRedisClient } from '@chess960/utils';
import type { TimeControl } from '@chess960/proto';

export interface GuestRating {
  rating: number;
  rd: number;
  vol: number;
}

export interface GuestStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
}

export interface GuestGame {
  id: string;
  timeControl: string;
  result: string;
  opponent: string;
  ratingBefore: number;
  ratingAfter?: number;
  timestamp: number;
}

export interface GuestSessionData {
  userId: string;
  handle: string;
  ratings: Record<string, GuestRating>;
  stats: GuestStats;
  games: GuestGame[];
  createdAt: number;
  lastActiveAt: number;
}

export class GuestPersistenceService {
  private redis = getRedisClient();
  private readonly GUEST_PREFIX = 'guest:';
  private readonly GUEST_SESSION_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

  constructor() {
    this.redis.connect().catch(console.error);
  }

  // Save guest session data to Redis
  async saveGuestSession(data: GuestSessionData): Promise<void> {
    try {
      const key = `${this.GUEST_PREFIX}${data.userId}`;
      
      // Convert data to Redis-friendly format
      const redisData = {
        userId: data.userId,
        handle: data.handle,
        ratings: JSON.stringify(data.ratings),
        stats: JSON.stringify(data.stats),
        games: JSON.stringify(data.games),
        createdAt: data.createdAt.toString(),
        lastActiveAt: data.lastActiveAt.toString(),
      };

      await this.redis.setHash(key, redisData);
      await this.redis.expire(key, this.GUEST_SESSION_TTL);
      
      console.log(`[GUEST-PERSISTENCE] Saved guest session for ${data.userId}`);
    } catch (error) {
      console.error('[GUEST-PERSISTENCE] Error saving guest session:', error);
    }
  }

  // Load guest session data from Redis
  async loadGuestSession(userId: string): Promise<GuestSessionData | null> {
    try {
      const key = `${this.GUEST_PREFIX}${userId}`;
      const data = await this.redis.getHash(key);
      
      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return {
        userId: data.userId,
        handle: data.handle,
        ratings: JSON.parse(data.ratings || '{}'),
        stats: JSON.parse(data.stats || '{}'),
        games: JSON.parse(data.games || '[]'),
        createdAt: parseInt(data.createdAt || '0'),
        lastActiveAt: parseInt(data.lastActiveAt || '0'),
      };
    } catch (error) {
      console.error('[GUEST-PERSISTENCE] Error loading guest session:', error);
      return null;
    }
  }

  // Update guest session with new data
  async updateGuestSession(
    userId: string,
    updates: Partial<Pick<GuestSessionData, 'ratings' | 'stats' | 'games' | 'lastActiveAt'>>
  ): Promise<void> {
    try {
      const existing = await this.loadGuestSession(userId);
      if (!existing) {
        console.warn(`[GUEST-PERSISTENCE] No existing session found for ${userId}`);
        return;
      }

      const updatedData: GuestSessionData = {
        ...existing,
        ...updates,
        lastActiveAt: updates.lastActiveAt || Date.now(),
      };

      await this.saveGuestSession(updatedData);
    } catch (error) {
      console.error('[GUEST-PERSISTENCE] Error updating guest session:', error);
    }
  }

  // Delete guest session
  async deleteGuestSession(userId: string): Promise<void> {
    try {
      const key = `${this.GUEST_PREFIX}${userId}`;
      await this.redis.deleteHash(key);
      console.log(`[GUEST-PERSISTENCE] Deleted guest session for ${userId}`);
    } catch (error) {
      console.error('[GUEST-PERSISTENCE] Error deleting guest session:', error);
    }
  }

  // Check if guest session exists
  async hasGuestSession(userId: string): Promise<boolean> {
    try {
      const key = `${this.GUEST_PREFIX}${userId}`;
      const data = await this.redis.getHash(key);
      return Object.keys(data).length > 0;
    } catch (error) {
      console.error('[GUEST-PERSISTENCE] Error checking guest session:', error);
      return false;
    }
  }

  // Get all guest sessions (for admin purposes)
  async getAllGuestSessions(): Promise<GuestSessionData[]> {
    try {
      // This would require scanning all keys with the guest prefix
      // For now, we'll return an empty array as this is not critical
      console.log('[GUEST-PERSISTENCE] Getting all guest sessions not implemented yet');
      return [];
    } catch (error) {
      console.error('[GUEST-PERSISTENCE] Error getting all guest sessions:', error);
      return [];
    }
  }

  // Clean up expired sessions (can be called periodically)
  async cleanupExpiredSessions(): Promise<number> {
    try {
      // Redis TTL handles this automatically, but we could add additional cleanup logic here
      console.log('[GUEST-PERSISTENCE] Cleanup expired sessions not implemented yet');
      return 0;
    } catch (error) {
      console.error('[GUEST-PERSISTENCE] Error cleaning up expired sessions:', error);
      return 0;
    }
  }
}

// Singleton instance
export const guestPersistenceService = new GuestPersistenceService();

















