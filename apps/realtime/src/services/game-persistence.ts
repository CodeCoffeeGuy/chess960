import { db } from '@chess960/db';
import { updateGlicko2, type GameResult } from '@chess960/rating';
import { timeControlToDbEnum, timeControlToRatingCategory, type TimeControl } from '@chess960/proto';
import type { GameState } from '../types';
import { guestRatingManager } from './guest-rating-manager';

export class GamePersistenceService {
  
  // Persist game when it starts (for live games list)
  async persistGameStart(gameState: GameState): Promise<void> {
    if (!gameState.tc) {
      console.error('Game missing time control:', gameState.id);
      return;
    }

    try {
      // Map time control to database enum
      const tcEnum = timeControlToDbEnum(gameState.tc as any);
      
      // Use speed-based rating category for getting ratings
      const ratingTc = timeControlToRatingCategory(gameState.tc as any) as any;

      // Get ratings before the game for both players
      const [whiteRating, blackRating] = await Promise.all([
        this.getOrCreateRating(gameState.whiteId, ratingTc),
        this.getOrCreateRating(gameState.blackId, ratingTc),
      ]);

      // Handle guest users
      const isWhiteGuest = gameState.whiteId.startsWith('guest_');
      const isBlackGuest = gameState.blackId.startsWith('guest_');

      const whiteRatingBefore = isWhiteGuest 
        ? (await guestRatingManager.getGuestRating(gameState.whiteId, ratingTc)).rating
        : (whiteRating ? Math.round(Number(whiteRating.rating)) : 1500);
      
      const blackRatingBefore = isBlackGuest 
        ? (await guestRatingManager.getGuestRating(gameState.blackId, ratingTc)).rating
        : (blackRating ? Math.round(Number(blackRating.rating)) : 1500);

      // Create game record without endedAt (game is live)
      await db.game.upsert({
        where: { id: gameState.id },
        create: {
          id: gameState.id,
          whiteId: gameState.whiteId,
          blackId: gameState.blackId,
          tc: tcEnum as any,
          rated: true,
          chess960Position: gameState.chess960Position,
          startedAt: new Date(gameState.startedAt),
          endedAt: null, // Game is live
          result: null,
          whiteTimeMs: gameState.timeLeft.white,
          blackTimeMs: gameState.timeLeft.black,
          whiteIncMs: gameState.increment.white,
          blackIncMs: gameState.increment.black,
          whiteRatingBefore,
          blackRatingBefore,
        },
        update: {
          // Update if game already exists (shouldn't happen, but handle it)
          whiteTimeMs: gameState.timeLeft.white,
          blackTimeMs: gameState.timeLeft.black,
        },
      });

      console.log(`Game ${gameState.id} persisted as live game`);
    } catch (error) {
      console.error('Failed to persist game start:', gameState.id, error);
      // Don't throw - we don't want to block game creation if persistence fails
    }
  }
  
  async persistGame(gameState: GameState): Promise<void> {
    if (!gameState.result || !gameState.ended) {
      console.warn('Attempting to persist incomplete game:', gameState.id);
      return;
    }

    if (!gameState.tc) {
      console.error('Game missing time control:', gameState.id);
      return;
    }

    try {
      // Map time control to database enum for game record
      const tcEnum = timeControlToDbEnum(gameState.tc as any);

      // Use speed-based rating category (BULLET, BLITZ, RAPID, CLASSICAL)
      const ratingTc = timeControlToRatingCategory(gameState.tc as any) as any;

      // Get ratings before the game for both players
      const [whiteRating, blackRating] = await Promise.all([
        this.getOrCreateRating(gameState.whiteId, ratingTc),
        this.getOrCreateRating(gameState.blackId, ratingTc),
      ]);

      // Handle guest users
      const isWhiteGuest = gameState.whiteId.startsWith('guest_');
      const isBlackGuest = gameState.blackId.startsWith('guest_');

      const whiteRatingBefore = isWhiteGuest 
        ? (await guestRatingManager.getGuestRating(gameState.whiteId, ratingTc)).rating
        : (whiteRating ? Math.round(Number(whiteRating.rating)) : 1500);
      
      const blackRatingBefore = isBlackGuest 
        ? (await guestRatingManager.getGuestRating(gameState.blackId, ratingTc)).rating
        : (blackRating ? Math.round(Number(blackRating.rating)) : 1500);

      // Update existing game record (it should have been created when game started)
      // Use upsert in case the game start wasn't persisted for some reason
      const game = await db.game.upsert({
        where: { id: gameState.id },
        create: {
          id: gameState.id,
          whiteId: gameState.whiteId,
          blackId: gameState.blackId,
          tc: tcEnum as any,
          rated: true,
          chess960Position: gameState.chess960Position,
          startedAt: new Date(gameState.startedAt),
          endedAt: new Date(),
          result: gameState.result,
          whiteTimeMs: gameState.timeLeft.white,
          blackTimeMs: gameState.timeLeft.black,
          whiteIncMs: gameState.increment.white,
          blackIncMs: gameState.increment.black,
          whiteRatingBefore,
          blackRatingBefore,
        },
        update: {
          endedAt: new Date(),
          result: gameState.result,
          whiteTimeMs: gameState.timeLeft.white,
          blackTimeMs: gameState.timeLeft.black,
        },
      });

      // Persist moves
      const moveData = gameState.moves.map((uci, index) => ({
        gameId: gameState.id,
        ply: index + 1,
        uci,
        serverTs: BigInt(gameState.lastMoveAt + (index * 1000)), // Approximate timestamps
        byColor: index % 2 === 0 ? 'w' : 'b',
      }));

      if (moveData.length > 0) {
        await db.move.createMany({
          data: moveData,
        });
      }

      console.log(`Game ${gameState.id} persisted successfully`);

      // Update ratings if it's a completed game (not abort)
      if (gameState.result !== 'abort' && this.isGameCompleted(gameState.result)) {
        await this.updatePlayerRatings(gameState, ratingTc, game.id);
      }

      // Update guest ratings and stats
      if (gameState.result !== 'abort' && this.isGameCompleted(gameState.result)) {
        await this.updateGuestRatingsAndStats(gameState, ratingTc);
      }

      // Update user stats (games played, won, lost, drawn)
      await this.updateUserStats(gameState);

      // Game completion notifications removed as requested

    } catch (error) {
      console.error('Failed to persist game:', gameState.id, error);
      throw error;
    }
  }

  private async updatePlayerRatings(gameState: GameState, tc: TimeControl, gameId: string): Promise<void> {
    try {
      // Get current ratings for both players, creating them if they don't exist
      const [whiteRating, blackRating] = await Promise.all([
        this.getOrCreateRating(gameState.whiteId, tc),
        this.getOrCreateRating(gameState.blackId, tc),
      ]);

      if (!whiteRating || !blackRating) {
        console.error('Failed to get or create rating records for game:', gameState.id);
        return;
      }

      // Convert result to numeric values for Glicko-2
      const { whiteResult, blackResult } = this.parseGameResult(gameState.result || '1/2-1/2');

      // Update white player's rating
      const whiteNewRating = updateGlicko2(
        {
          rating: Number(whiteRating.rating),
          rd: Number(whiteRating.rd),
          vol: Number(whiteRating.vol),
        },
        [
          {
            opponent: {
              rating: Number(blackRating.rating),
              rd: Number(blackRating.rd),
              vol: Number(blackRating.vol),
            },
            result: whiteResult,
          },
        ]
      );

      // Update black player's rating
      const blackNewRating = updateGlicko2(
        {
          rating: Number(blackRating.rating),
          rd: Number(blackRating.rd),
          vol: Number(blackRating.vol),
        },
        [
          {
            opponent: {
              rating: Number(whiteRating.rating),
              rd: Number(whiteRating.rd),
              vol: Number(whiteRating.vol),
            },
            result: blackResult,
          },
        ]
      );

      const whiteRatingAfter = Math.round(whiteNewRating.rating);
      const blackRatingAfter = Math.round(blackNewRating.rating);

      // Save updated ratings to ratings table and game record
      await Promise.all([
        db.rating.update({
          where: {
            userId_tc_variant: {
              userId: gameState.whiteId,
              tc,
              variant: 'CHESS960'
            }
          },
          data: {
            rating: whiteNewRating.rating,
            rd: whiteNewRating.rd,
            vol: whiteNewRating.vol,
            updatedAt: new Date(),
          },
        }),
        db.rating.update({
          where: {
            userId_tc_variant: {
              userId: gameState.blackId,
              tc,
              variant: 'CHESS960'
            }
          },
          data: {
            rating: blackNewRating.rating,
            rd: blackNewRating.rd,
            vol: blackNewRating.vol,
            updatedAt: new Date(),
          },
        }),
        db.game.update({
          where: { id: gameId },
          data: {
            whiteRatingAfter,
            blackRatingAfter,
          },
        }),
      ]);

      const whiteChange = whiteRatingAfter - Math.round(Number(whiteRating.rating));
      const blackChange = blackRatingAfter - Math.round(Number(blackRating.rating));

      console.log(`Ratings updated for game ${gameState.id}:`);
      console.log(`White: ${Math.round(Number(whiteRating.rating))} → ${whiteRatingAfter} (${whiteChange >= 0 ? '+' : ''}${whiteChange})`);
      console.log(`Black: ${Math.round(Number(blackRating.rating))} → ${blackRatingAfter} (${blackChange >= 0 ? '+' : ''}${blackChange})`);

    } catch (error) {
      console.error('Failed to update ratings for game:', gameState.id, error);
    }
  }

  private parseGameResult(result: string): { whiteResult: GameResult; blackResult: GameResult } {
    switch (result) {
      case '1-0':
      case 'checkmate-black': // Black was checkmated, white wins
        return { whiteResult: 1, blackResult: 0 };
      case '0-1':
      case 'checkmate-white': // White was checkmated, black wins
        return { whiteResult: 0, blackResult: 1 };
      case '1/2-1/2':
      case 'draw':
      case 'Stalemate':
      case 'Threefold repetition':
      case 'Insufficient material':
      case '50-move rule':
        return { whiteResult: 0.5, blackResult: 0.5 };
      case 'flag-white':
        return { whiteResult: 0, blackResult: 1 };
      case 'flag-black':
        return { whiteResult: 1, blackResult: 0 };
      case 'resign-white':
        return { whiteResult: 0, blackResult: 1 };
      case 'resign-black':
        return { whiteResult: 1, blackResult: 0 };
      case 'abort':
      case 'timeout-start':
        // No rating change for aborted/timeout games
        return { whiteResult: 0.5, blackResult: 0.5 };
      default:
        console.warn(`Unknown game result: ${result}, treating as draw`);
        // For unknown results, treat as draw
        return { whiteResult: 0.5, blackResult: 0.5 };
    }
  }

  private isGameCompleted(result: string): boolean {
    // Don't update ratings for aborted or timeout-start games
    return result !== 'abort' && result !== 'timeout-start';
  }

  private async updateGuestRatingsAndStats(gameState: GameState, tc: TimeControl): Promise<void> {
    try {
      const { whiteResult, blackResult } = this.parseGameResult(gameState.result || '1/2-1/2');
      const isWhiteGuest = gameState.whiteId.startsWith('guest_');
      const isBlackGuest = gameState.blackId.startsWith('guest_');

      // Get ratings before updating for history tracking
      let whiteRatingBefore = 1500;
      let blackRatingBefore = 1500;

      if (isWhiteGuest) {
        const whiteRating = await guestRatingManager.getGuestRating(gameState.whiteId, tc);
        whiteRatingBefore = whiteRating.rating;
      }
      if (isBlackGuest) {
        const blackRating = await guestRatingManager.getGuestRating(gameState.blackId, tc);
        blackRatingBefore = blackRating.rating;
      }

      // Update guest ratings
      if (isWhiteGuest && !isBlackGuest) {
        // White is guest, black is registered user
        const blackRating = await this.getOrCreateRating(gameState.blackId, tc);
        if (blackRating) {
          const newWhiteRating = await guestRatingManager.updateGuestRating(
            gameState.whiteId,
            tc,
            {
              rating: Number(blackRating.rating),
              rd: Number(blackRating.rd),
              vol: Number(blackRating.vol),
            },
            whiteResult
          );
          console.log(`Guest ${gameState.whiteId} rating updated: ${newWhiteRating.rating}`);
        }
      } else if (isBlackGuest && !isWhiteGuest) {
        // Black is guest, white is registered user
        const whiteRating = await this.getOrCreateRating(gameState.whiteId, tc);
        if (whiteRating) {
          const newBlackRating = await guestRatingManager.updateGuestRating(
            gameState.blackId,
            tc,
            {
              rating: Number(whiteRating.rating),
              rd: Number(whiteRating.rd),
              vol: Number(whiteRating.vol),
            },
            blackResult
          );
          console.log(`Guest ${gameState.blackId} rating updated: ${newBlackRating.rating}`);
        }
      } else if (isWhiteGuest && isBlackGuest) {
        // Both are guests - use current ratings
        const whiteCurrentRating = await guestRatingManager.getGuestRating(gameState.whiteId, tc);
        const blackCurrentRating = await guestRatingManager.getGuestRating(gameState.blackId, tc);

        const newWhiteRating = await guestRatingManager.updateGuestRating(
          gameState.whiteId,
          tc,
          blackCurrentRating,
          whiteResult
        );

        const newBlackRating = await guestRatingManager.updateGuestRating(
          gameState.blackId,
          tc,
          whiteCurrentRating,
          blackResult
        );

        console.log(`Guest vs Guest ratings updated: White ${newWhiteRating.rating}, Black ${newBlackRating.rating}`);
      }

      // Update guest stats
      if (isWhiteGuest) {
        await guestRatingManager.updateGuestStats(gameState.whiteId, whiteResult);
      }
      if (isBlackGuest) {
        await guestRatingManager.updateGuestStats(gameState.blackId, blackResult);
      }

      // Add game to guest history
      if (isWhiteGuest) {
        const whiteRatingAfter = await guestRatingManager.getGuestRating(gameState.whiteId, tc);
        await guestRatingManager.addGuestGame(gameState.whiteId, {
          id: gameState.id,
          timeControl: gameState.tc || tc,
          result: gameState.result || 'unknown',
          opponent: gameState.blackId,
          ratingBefore: whiteRatingBefore,
          ratingAfter: whiteRatingAfter.rating,
          timestamp: Date.now(),
        });
      }
      if (isBlackGuest) {
        const blackRatingAfter = await guestRatingManager.getGuestRating(gameState.blackId, tc);
        await guestRatingManager.addGuestGame(gameState.blackId, {
          id: gameState.id,
          timeControl: gameState.tc || tc,
          result: gameState.result || 'unknown',
          opponent: gameState.whiteId,
          ratingBefore: blackRatingBefore,
          ratingAfter: blackRatingAfter.rating,
          timestamp: Date.now(),
        });
      }

    } catch (error) {
      console.error('Failed to update guest ratings and stats:', error);
    }
  }

  private async updateUserStats(gameState: GameState): Promise<void> {
    try {
      if (!gameState.result || gameState.result === 'abort') {
        // Don't update stats for aborted games
        return;
      }

      const { whiteResult, blackResult } = this.parseGameResult(gameState.result);
      const isWhiteGuest = gameState.whiteId.startsWith('guest_');
      const isBlackGuest = gameState.blackId.startsWith('guest_');

      // Only update database stats for registered users
      const updates = [];
      
      if (!isWhiteGuest) {
        const getStatsUpdate = (result: GameResult) => {
          if (result === 1) {
            return { gamesWon: { increment: 1 } };
          } else if (result === 0) {
            return { gamesLost: { increment: 1 } };
          } else {
            return { gamesDrawn: { increment: 1 } };
          }
        };

        updates.push(
          db.user.update({
            where: { id: gameState.whiteId },
            data: {
              gamesPlayed: { increment: 1 },
              ...getStatsUpdate(whiteResult),
            },
          })
        );
      }

      if (!isBlackGuest) {
        const getStatsUpdate = (result: GameResult) => {
          if (result === 1) {
            return { gamesWon: { increment: 1 } };
          } else if (result === 0) {
            return { gamesLost: { increment: 1 } };
          } else {
            return { gamesDrawn: { increment: 1 } };
          }
        };

        updates.push(
          db.user.update({
            where: { id: gameState.blackId },
            data: {
              gamesPlayed: { increment: 1 },
              ...getStatsUpdate(blackResult),
            },
          })
        );
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        console.log(`User stats updated for game ${gameState.id}`);
      }
    } catch (error) {
      console.error('Failed to update user stats for game:', gameState.id, error);
    }
  }

  async getGameHistory(userId: string, limit = 20, offset = 0): Promise<any[]> {
    try {
      const games = await db.game.findMany({
        where: {
          OR: [
            { whiteId: userId },
            { blackId: userId },
          ],
          endedAt: { not: null },
        },
        include: {
          white: {
            select: { handle: true },
          },
          black: {
            select: { handle: true },
          },
          moves: {
            orderBy: { ply: 'asc' },
            select: { uci: true, ply: true },
          },
        },
        orderBy: { endedAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return games.map((game: any) => {
        // Convert database enum back to time control string
        const tc = this.dbEnumToTimeControl(game.tc);

        return {
          id: game.id,
          tc,
          result: game.result,
          rated: game.rated,
          startedAt: game.startedAt,
          endedAt: game.endedAt,
          playerColor: game.whiteId === userId ? 'white' : 'black',
          opponent: game.whiteId === userId ? game.black?.handle : game.white?.handle,
          moves: game.moves.map((move: any) => move.uci),
          moveCount: game.moves.length,
        };
      });

    } catch (error) {
      console.error('Failed to get game history for user:', userId, error);
      return [];
    }
  }

  async getPlayerStats(userId: string): Promise<any> {
    try {
      const [games, currentRatings] = await Promise.all([
        db.game.findMany({
          where: {
            OR: [{ whiteId: userId }, { blackId: userId }],
            result: { not: 'abort' },
            endedAt: { not: null },
          },
          select: {
            result: true,
            whiteId: true,
            tc: true,
          },
        }),
        db.rating.findMany({
          where: { userId },
          select: { tc: true, rating: true, rd: true, updatedAt: true },
        }),
      ]);

      // Calculate stats by time control
      const statsByTc: Record<string, any> = {};

      games.forEach((game: any) => {
        const tc = this.dbEnumToTimeControl(game.tc);
        if (!statsByTc[tc]) {
          statsByTc[tc] = { wins: 0, losses: 0, draws: 0, total: 0 };
        }

        const isWhite = game.whiteId === userId;
        const result = game.result;

        statsByTc[tc].total++;

        if (result === '1-0') {
          if (isWhite) statsByTc[tc].wins++;
          else statsByTc[tc].losses++;
        } else if (result === '0-1') {
          if (isWhite) statsByTc[tc].losses++;
          else statsByTc[tc].wins++;
        } else if (result === '1/2-1/2') {
          statsByTc[tc].draws++;
        } else if (result?.includes('flag') || result?.includes('resign')) {
          // Determine winner from result
          const whiteWon = result === 'flag-black' || result === 'resign-black';
          if ((whiteWon && isWhite) || (!whiteWon && !isWhite)) {
            statsByTc[tc].wins++;
          } else {
            statsByTc[tc].losses++;
          }
        }
      });

      // Format ratings - ratings are stored by speed category (BULLET, BLITZ, RAPID, CLASSICAL)
      const ratings: Record<string, any> = {};
      currentRatings.forEach((rating: any) => {
        const tc = this.dbEnumToTimeControl(rating.tc);

        ratings[tc] = {
          rating: Math.round(Number(rating.rating)),
          rd: Math.round(Number(rating.rd)),
          lastGame: rating.updatedAt,
        };
      });

      return {
        ratings,
        stats: statsByTc,
        totalGames: games.length,
      };

    } catch (error) {
      console.error('Failed to get player stats:', userId, error);
      return { ratings: {}, stats: {}, totalGames: 0 };
    }
  }

  // Convert database enum back to time control string
  private dbEnumToTimeControl(dbEnum: string): string {
    const enumMap: Record<string, string> = {
      'ONE_PLUS_ZERO': '1+0',
      'TWO_PLUS_ZERO': '2+0',
      'TWO_PLUS_ONE': '2+1',
      'THREE_PLUS_ZERO': '3+0',
      'THREE_PLUS_TWO': '3+2',
      'FIVE_PLUS_ZERO': '5+0',
      'FIVE_PLUS_THREE': '5+3',
      'TEN_PLUS_ZERO': '10+0',
      'TEN_PLUS_FIVE': '10+5',
      'FIFTEEN_PLUS_ZERO': '15+0',
      'FIFTEEN_PLUS_TEN': '15+10',
      'THIRTY_PLUS_ZERO': '30+0',
      'THIRTY_PLUS_TWENTY': '30+20',
      'SIXTY_PLUS_ZERO': '60+0',
      'BULLET': 'bullet',
      'BLITZ': 'blitz',
      'RAPID': 'rapid',
      'CLASSICAL': 'classical',
    };
    return enumMap[dbEnum] || dbEnum;
  }

  // Get or create a rating record for a user and time control
  private async getOrCreateRating(userId: string, tc: TimeControl) {
    try {
      // Skip guest users
      if (userId.startsWith('guest_')) {
        return null;
      }

      // Try to find existing rating
      let rating = await db.rating.findUnique({
        where: {
          userId_tc_variant: {
            userId,
            tc,
            variant: 'CHESS960'
          }
        }
      });

      // If not found, create it with default values
      if (!rating) {
        console.log(`Creating initial rating for user ${userId} tc ${tc}`);
        rating = await db.rating.create({
          data: {
            userId,
            tc,
            rating: 1500,
            rd: 350,
            vol: 0.06,
          }
        });
      }

      return rating;
    } catch (error) {
      console.error(`Failed to get or create rating for user ${userId}, tc ${tc}:`, error);
      return null;
    }
  }

  // Clean up old incomplete games (run periodically)
  async cleanupIncompleteGames(olderThanMinutes = 60): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
      
      const result = await db.game.deleteMany({
        where: {
          startedAt: { lt: cutoff },
          endedAt: null,
        },
      });

      console.log(`Cleaned up ${result.count} incomplete games older than ${olderThanMinutes} minutes`);
      return result.count;

    } catch (error) {
      console.error('Failed to cleanup incomplete games:', error);
      return 0;
    }
  }

}

// Singleton instance
let persistenceServiceInstance: GamePersistenceService | null = null;

export function getGamePersistenceService(): GamePersistenceService {
  if (!persistenceServiceInstance) {
    persistenceServiceInstance = new GamePersistenceService();
  }
  return persistenceServiceInstance;
}