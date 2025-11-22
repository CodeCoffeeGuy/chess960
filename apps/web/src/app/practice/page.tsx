'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { GraduationCap, BookOpen, Target, TrendingUp, CheckCircle2, Filter } from 'lucide-react';

interface Practice {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  lessonCount: number;
  completionCount: number;
  isCompleted: boolean;
  userScore: number | null;
  completedAt: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  OPENING: 'Opening',
  MIDDLEGAME: 'Middlegame',
  ENDGAME: 'Endgame',
  TACTICS: 'Tactics',
  STRATEGY: 'Strategy',
  CHECKMATE: 'Checkmate',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  BEGINNER: 'bg-green-500',
  INTERMEDIATE: 'bg-yellow-500',
  ADVANCED: 'bg-orange-500',
  EXPERT: 'bg-red-500',
};

export default function PracticePage() {
  const { data: session } = useSession();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  useEffect(() => {
    fetchPractices();
  }, [categoryFilter, difficultyFilter]);

  const fetchPractices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      if (difficultyFilter !== 'all') {
        params.append('difficulty', difficultyFilter);
      }
      const response = await fetch(`/api/practice?${params.toString()}`);
      const data = await response.json();
      setPractices(data.practices || []);
    } catch (error) {
      console.error('Error fetching practices:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedPractices = practices.reduce((acc, practice) => {
    if (!acc[practice.category]) {
      acc[practice.category] = [];
    }
    acc[practice.category].push(practice);
    return acc;
  }, {} as Record<string, Practice[]>);

  return (
    <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-orange-400" />
            Practice Mode
          </h1>
          <div className="text-[#b6aea2] light:text-[#5a5449] max-w-2xl mx-auto space-y-2 px-4">
            <p className="text-sm sm:text-base">
              Interactive lessons to improve your chess skills
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 sm:mb-8 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-orange-300" />
              <span className="text-xs sm:text-sm font-semibold text-[#a0958a] light:text-[#5a5449]">Filters</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-center sm:gap-4">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-2 bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:border-orange-300 transition-colors font-semibold text-sm sm:text-base appearance-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-2 bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:border-orange-300 transition-colors font-semibold text-sm sm:text-base appearance-none cursor-pointer"
              >
                <option value="all">All Difficulties</option>
                {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Practices List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-[#a0958a] light:text-[#6b6560]">Loading practices...</p>
          </div>
        ) : practices.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap className="w-16 h-16 text-[#a0958a] light:text-[#6b6560] mx-auto mb-4" />
            <p className="text-[#a0958a] light:text-[#6b6560] text-lg">No practices found</p>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8 px-4 sm:px-0">
            {Object.entries(groupedPractices).map(([category, categoryPractices]) => (
              <div key={category}>
                <h2 className="text-xl sm:text-2xl font-semibold text-white light:text-black mb-3 sm:mb-4 flex items-center gap-2 px-2 sm:px-0">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                  {CATEGORY_LABELS[category] || category}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {categoryPractices.map((practice) => (
                    <Link
                      key={practice.id}
                      href={`/practice/${practice.id}`}
                      className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4 sm:p-6 hover:border-orange-300/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] relative"
                    >
                      {practice.isCompleted && (
                        <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
                          <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <h3 className="text-lg sm:text-xl font-semibold text-white light:text-black flex-1 pr-2">
                          {practice.title}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs rounded ${DIFFICULTY_COLORS[practice.difficulty]} text-white flex-shrink-0`}
                        >
                          {DIFFICULTY_LABELS[practice.difficulty]}
                        </span>
                      </div>
                      {practice.description && (
                        <p className="text-[#a0958a] light:text-[#6b6560] text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">
                          {practice.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-[#a0958a] light:text-[#6b6560]">
                        <div className="flex items-center gap-1">
                          <Target className="w-3 h-3 sm:w-4 sm:h-4" />
                          {practice.lessonCount} {practice.lessonCount === 1 ? 'lesson' : 'lessons'}
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                          {practice.completionCount} completed
                        </div>
                      </div>
                      {practice.isCompleted && practice.userScore !== null && (
                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[#474239] light:border-[#d4caba]">
                          <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#6b6560]">
                            Your score: <span className="text-white light:text-black font-semibold">{practice.userScore}%</span>
                          </div>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

