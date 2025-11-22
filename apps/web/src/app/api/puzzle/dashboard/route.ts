import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@chess960/db';
import { getAuthService } from '@chess960/utils';

const IRRELEVANT_THEMES = [
  'oneMove',
  'short',
  'long',
  'veryLong',
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'mateIn4',
  'mateIn5',
  'equality',
  'advantage',
  'crushing',
  'master',
  'masterVsMaster',
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let userId: string | null = null;

    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      const authToken = request.cookies.get('auth-token')?.value;
      if (authToken) {
        const authService = getAuthService();
        const payload = authService.verifyAuthToken(authToken);
        if (payload) {
          userId = payload.userId;
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 90);

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get all rounds in the time period
    const rounds = await (db as any).puzzleRound.findMany({
      where: {
        userId,
        createdAt: {
          gte: since,
        },
      },
      include: {
        puzzle: {
          select: {
            rating: true,
            themes: true,
          },
        },
      },
    });

    if (rounds.length === 0) {
      return NextResponse.json({
        global: {
          total: 0,
          wins: 0,
          losses: 0,
          firstWins: 0,
          winRate: 0,
          performance: 1500,
          averagePuzzleRating: 1500,
        },
        byTheme: {},
        weakThemes: [],
        strongThemes: [],
      });
    }

    // Calculate global stats
    const globalStats = {
      total: rounds.length,
      wins: rounds.filter((r: any) => r.win).length,
      losses: rounds.filter((r: any) => !r.win).length,
      firstWins: rounds.filter((r: any) => r.win && r.ratingDiff && r.ratingDiff !== 0).length,
      averagePuzzleRating: rounds.length > 0
        ? Math.round(
            rounds.reduce((sum: number, r: any) => sum + Number(r.puzzle?.rating || 1500), 0) / rounds.length
          )
        : 1500,
    };

    const winRate = globalStats.total > 0 ? Math.round((globalStats.wins / globalStats.total) * 100) : 0;
    const performance = Math.round(
      globalStats.averagePuzzleRating - 500 + Math.round(1000 * (globalStats.firstWins / globalStats.total))
    );

    // Calculate stats by theme
    const themeStats: Record<string, {
      total: number;
      wins: number;
      losses: number;
      firstWins: number;
      averagePuzzleRating: number;
      performance: number;
    }> = {};

    rounds.forEach((round: any) => {
      const themes = round.puzzle.themes || [];
      themes.forEach((theme: string) => {
        if (IRRELEVANT_THEMES.includes(theme)) return;

        if (!themeStats[theme]) {
          themeStats[theme] = {
            total: 0,
            wins: 0,
            losses: 0,
            firstWins: 0,
            averagePuzzleRating: 0,
            performance: 0,
          };
        }

        themeStats[theme].total++;
        if (round.win) {
          themeStats[theme].wins++;
          if (round.ratingDiff && round.ratingDiff !== 0) {
            themeStats[theme].firstWins++;
          }
        } else {
          themeStats[theme].losses++;
        }
      });
    });

    // Calculate performance for each theme
    Object.keys(themeStats).forEach((theme) => {
      const stats = themeStats[theme];
      const themeRounds = rounds.filter((r: any) => (r.puzzle?.themes || []).includes(theme));
      stats.averagePuzzleRating = themeRounds.length > 0
        ? Math.round(
            themeRounds.reduce((sum: number, r: any) => sum + Number(r.puzzle?.rating || 1500), 0) / themeRounds.length
          )
        : 1500;
      stats.performance = stats.total > 0
        ? Math.round(
            stats.averagePuzzleRating - 500 + Math.round(1000 * (stats.firstWins / stats.total))
          )
        : 1500;
    });

    // Filter themes with enough data (at least 1% of total)
    const minPuzzles = Math.max(1, Math.floor(globalStats.total / 40));
    const relevantThemes = Object.entries(themeStats).filter(([_, stats]) => stats.total >= minPuzzles);

    // Find weak themes (failed >= 3, performance < global)
    const weakThemes = relevantThemes
      .filter(([_, stats]) => stats.losses >= 3 && stats.performance < performance)
      .sort((a, b) => a[1].performance - b[1].performance)
      .slice(0, 8)
      .map(([theme, stats]) => ({
        theme,
        ...stats,
        winRate: Math.round((stats.wins / stats.total) * 100),
      }));

    // Find strong themes (firstWins >= 3, performance > global)
    const strongThemes = relevantThemes
      .filter(([_, stats]) => stats.firstWins >= 3 && stats.performance > performance)
      .sort((a, b) => b[1].performance - a[1].performance)
      .slice(0, 8)
      .map(([theme, stats]) => ({
        theme,
        ...stats,
        winRate: Math.round((stats.wins / stats.total) * 100),
      }));

    // Most played themes
    const mostPlayed = relevantThemes
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 9)
      .map(([theme, stats]) => ({
        theme,
        ...stats,
        winRate: Math.round((stats.wins / stats.total) * 100),
      }));

    return NextResponse.json({
      global: {
        total: globalStats.total,
        wins: globalStats.wins,
        losses: globalStats.losses,
        firstWins: globalStats.firstWins,
        winRate,
        performance,
        averagePuzzleRating: globalStats.averagePuzzleRating,
      },
      byTheme: Object.fromEntries(
        relevantThemes.map(([theme, stats]) => [
          theme,
          {
            ...stats,
            winRate: Math.round((stats.wins / stats.total) * 100),
          },
        ])
      ),
      weakThemes,
      strongThemes,
      mostPlayed,
    });
  } catch (error) {
    console.error('Error fetching puzzle dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}


