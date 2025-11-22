'use client';

import { useState, useEffect } from 'react';
import { Tag, Check } from 'lucide-react';

interface ThemeVotingProps {
  puzzleId: string;
  initialThemes?: string[];
}

const THEME_CATEGORIES: Record<string, { label: string; themes: string[] }> = {
  phases: {
    label: 'Phases',
    themes: ['opening', 'middlegame', 'endgame'],
  },
  tactics: {
    label: 'Tactics',
    themes: ['tactics', 'fork', 'pin', 'skewer', 'sacrifice', 'discoveredAttack', 'doubleCheck'],
  },
  mates: {
    label: 'Mates',
    themes: ['mate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5', 'backRankMate', 'smotheredMate'],
  },
  advanced: {
    label: 'Advanced',
    themes: ['deflection', 'attraction', 'clearance', 'interference', 'xRayAttack', 'zugzwang'],
  },
  pieces: {
    label: 'Pieces',
    themes: ['hangingPiece', 'trappedPiece', 'advancedPawn'],
  },
  endgames: {
    label: 'Endgames',
    themes: ['rookEndgame', 'bishopEndgame', 'knightEndgame', 'pawnEndgame', 'queenEndgame'],
  },
  special: {
    label: 'Special Moves',
    themes: ['promotion', 'underPromotion', 'castling', 'enPassant'],
  },
};

const THEME_LABELS: Record<string, string> = {
  tactics: 'Tactics',
  endgame: 'Endgame',
  opening: 'Opening',
  middlegame: 'Middlegame',
  mate: 'Mate',
  mateIn1: 'Mate in 1',
  mateIn2: 'Mate in 2',
  mateIn3: 'Mate in 3',
  mateIn4: 'Mate in 4',
  mateIn5: 'Mate in 5',
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  sacrifice: 'Sacrifice',
  discoveredAttack: 'Discovered Attack',
  doubleCheck: 'Double Check',
  backRankMate: 'Back Rank Mate',
  smotheredMate: 'Smothered Mate',
  promotion: 'Promotion',
  underPromotion: 'Under Promotion',
  castling: 'Castling',
  enPassant: 'En Passant',
  hangingPiece: 'Hanging Piece',
  trappedPiece: 'Trapped Piece',
  deflection: 'Deflection',
  attraction: 'Attraction',
  clearance: 'Clearance',
  interference: 'Interference',
  xRayAttack: 'X-Ray Attack',
  zugzwang: 'Zugzwang',
  advancedPawn: 'Advanced Pawn',
  rookEndgame: 'Rook Endgame',
  bishopEndgame: 'Bishop Endgame',
  knightEndgame: 'Knight Endgame',
  pawnEndgame: 'Pawn Endgame',
  queenEndgame: 'Queen Endgame',
};

export function ThemeVoting({ puzzleId, initialThemes = [] }: ThemeVotingProps) {
  const [themes, setThemes] = useState<string[]>(initialThemes);
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchVotes();
  }, [puzzleId]);

  const fetchVotes = async () => {
    try {
      const response = await fetch(`/api/puzzle/${puzzleId}/vote-theme`);
      if (response.ok) {
        const data = await response.json();
        setThemes(data.themes || []);
        setUserVotes(new Set(data.userVotes || []));
        const counts: Record<string, number> = {};
        (data.voteCounts || []).forEach((vc: { theme: string; count: number }) => {
          counts[vc.theme] = vc.count;
        });
        setVoteCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching theme votes:', error);
    }
  };

  const handleVote = async (theme: string) => {
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/puzzle/${puzzleId}/vote-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });

      if (response.ok) {
        const data = await response.json();
        const newUserVotes = new Set(userVotes);
        if (data.voted) {
          newUserVotes.add(theme);
        } else {
          newUserVotes.delete(theme);
        }
        setUserVotes(newUserVotes);
        await fetchVotes(); // Refresh to get updated counts
      }
    } catch (error) {
      console.error('Error voting on theme:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#2a2926] light:bg-white/80 rounded-lg border border-[#3e3a33] light:border-[#d4caba] p-4">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-semibold text-white light:text-black">Puzzle Themes</h3>
      </div>

      {/* Confirmed themes (from votes) */}
      {themes.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-[#a0958a] light:text-[#5a5449] mb-2">Confirmed Themes</div>
          <div className="flex flex-wrap gap-2">
            {themes.map((theme) => (
              <span
                key={theme}
                className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-medium"
              >
                {THEME_LABELS[theme] || theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Theme categories */}
      <div className="space-y-2">
        {Object.entries(THEME_CATEGORIES).map(([categoryKey, category]) => (
          <div key={categoryKey}>
            <button
              onClick={() => setExpandedCategory(expandedCategory === categoryKey ? null : categoryKey)}
              className="w-full flex items-center justify-between text-xs text-[#a0958a] light:text-[#5a5449] hover:text-white light:hover:text-black transition-colors py-1"
            >
              <span>{category.label}</span>
              <span>{expandedCategory === categoryKey ? '−' : '+'}</span>
            </button>
            {expandedCategory === categoryKey && (
              <div className="flex flex-wrap gap-2 mt-2">
                {category.themes.map((theme) => {
                  const isVoted = userVotes.has(theme);
                  const count = voteCounts[theme] || 0;
                  const isConfirmed = themes.includes(theme);

                  return (
                    <button
                      key={theme}
                      onClick={() => handleVote(theme)}
                      disabled={loading}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                        isConfirmed
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : isVoted
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-[#3e3a33] light:bg-[#d4caba] text-white light:text-black border border-[#3e3a33] light:border-[#d4caba] hover:bg-[#474239] light:hover:bg-[#c4b5a5]'
                      }`}
                      title={`${count} vote${count !== 1 ? 's' : ''}`}
                    >
                      {isVoted && <Check className="w-3 h-3" />}
                      {THEME_LABELS[theme] || theme}
                      {count > 0 && (
                        <span className="text-[10px] opacity-75">({count})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-[#a0958a] light:text-[#5a5449]">
        Vote on themes to help categorize this puzzle. Themes with 2+ votes become confirmed.
      </div>
    </div>
  );
}









