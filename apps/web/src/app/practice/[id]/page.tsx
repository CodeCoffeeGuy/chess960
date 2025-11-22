'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Chess960Board } from '@chess960/board';
import { Chess } from 'chess.js';
import { ArrowLeft, CheckCircle2, Lightbulb, Target, Trophy, X, Check, AlertCircle } from 'lucide-react';
import {
  parsePgnToUci,
  validateMoveAgainstSolution,
  calculatePracticeScore,
  uciToSan,
} from '@/lib/practice-utils';

interface Practice {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  isCompleted: boolean;
  userScore: number | null;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  order: number;
  initialFen: string;
  instructions: string;
  solution: string | null;
  hints: string[];
}

interface LessonProgress {
  lessonId: string;
  completed: boolean;
  currentMoveIndex: number;
  correctMoves: number;
  wrongAttempts: number;
  hintsUsed: number;
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

export default function PracticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const practiceId = params.id as string;

  const [practice, setPractice] = useState<Practice | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  // Initialize currentFen with the first lesson's initialFen if available
  const [currentFen, setCurrentFen] = useState<string>('');
  const [chess, setChess] = useState<Chess | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  
  // Progress tracking
  const [lessonProgress, setLessonProgress] = useState<Map<string, LessonProgress>>(new Map());
  const [showCorrectFeedback, setShowCorrectFeedback] = useState(false);
  const [showWrongFeedback, setShowWrongFeedback] = useState(false);
  const [wrongMoveSquares, setWrongMoveSquares] = useState<[string, string] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canViewSolution, setCanViewSolution] = useState(false);

  // Parse solution moves for current lesson
  const currentLessonSolution = useMemo(() => {
    const lesson = practice?.lessons[currentLessonIndex];
    if (!lesson?.solution) return [];
    return parsePgnToUci(lesson.solution, lesson.initialFen);
  }, [practice, currentLessonIndex]);

  // Get current lesson progress
  const currentProgress = useMemo(() => {
    const lesson = practice?.lessons[currentLessonIndex];
    if (!lesson) return null;
    return lessonProgress.get(lesson.id) || {
      lessonId: lesson.id,
      completed: false,
      currentMoveIndex: 0,
      correctMoves: 0,
      wrongAttempts: 0,
      hintsUsed: 0,
    };
  }, [practice, currentLessonIndex, lessonProgress]);

  useEffect(() => {
    if (practiceId) {
      fetchPractice();
    }
  }, [practiceId]);

  useEffect(() => {
    if (practice?.lessons && practice.lessons.length > 0) {
      const lesson = practice.lessons[currentLessonIndex];
      if (!lesson.initialFen) {
        console.error('Lesson missing initialFen:', lesson);
        return;
      }
      
      // Use the lesson's initialFen directly - it's already a Chess960 FEN
      // IMPORTANT: Always use lesson.initialFen, not chess.fen() which might normalize it
      const game = new Chess(lesson.initialFen);
      setChess(game);
      // CRITICAL: Use initialFen directly to preserve Chess960 position
      // Don't use game.fen() as it might normalize the FEN
      setCurrentFen(lesson.initialFen);
      setShowHint(false);
      setHintIndex(0);
      setErrorMessage(null);
      setWrongMoveSquares(null);
      setCanViewSolution(false);
      
      // Reset progress if starting fresh
      const progress = lessonProgress.get(lesson.id);
      if (progress && !progress.completed) {
        // Reset to initial position but keep stats
        const resetGame = new Chess(lesson.initialFen);
        setChess(resetGame);
        setCurrentFen(lesson.initialFen); // Use initialFen directly
      }
    }
  }, [practice, currentLessonIndex, lessonProgress]);

  const fetchPractice = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/practice/${practiceId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/practice');
          return;
        }
        throw new Error('Failed to fetch practice');
      }
      const data = await response.json();
      setPractice(data.practice);
      setCompleted(data.practice.isCompleted);
      
      // Initialize progress for all lessons
      const initialProgress = new Map<string, LessonProgress>();
      data.practice.lessons.forEach((lesson: Lesson) => {
        initialProgress.set(lesson.id, {
          lessonId: lesson.id,
          completed: false,
          currentMoveIndex: 0,
          correctMoves: 0,
          wrongAttempts: 0,
          hintsUsed: 0,
        });
      });
      setLessonProgress(initialProgress);
    } catch (error) {
      console.error('Error fetching practice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMove = (from: string, to: string, promotion?: 'p' | 'r' | 'n' | 'b' | 'q' | 'k') => {
    if (!chess || !practice || !currentProgress || currentProgress.completed) return;
    
    const lesson = practice.lessons[currentLessonIndex];
    if (!lesson.solution) {
      // No solution - allow free play
      try {
        chess.move({ from, to, promotion });
        setCurrentFen(chess.fen());
      } catch (error) {
        setErrorMessage('Invalid move');
        setTimeout(() => setErrorMessage(null), 2000);
      }
      return;
    }

    // Store previous FEN for reverting wrong moves
    const previousFen = currentFen;
    
    try {
      const move = chess.move({ from, to, promotion });
      if (!move) {
        setErrorMessage('Invalid move');
        setTimeout(() => setErrorMessage(null), 2000);
        return;
      }

      // Convert to UCI format
      const userMove = `${from}${to}${promotion || ''}`;
      
      // Validate against solution
      const validation = validateMoveAgainstSolution(
        userMove,
        currentProgress.currentMoveIndex,
        currentLessonSolution
      );

      if (!validation.isValid) {
        // Wrong move - show feedback and revert
        const tempFen = chess.fen();
        setCurrentFen(tempFen);
        setWrongMoveSquares([from, to]);
        setShowWrongFeedback(true);
        setErrorMessage('Not the right move');
        
        // Update progress
        const updatedProgress = {
          ...currentProgress,
          wrongAttempts: currentProgress.wrongAttempts + 1,
        };
        setLessonProgress(prev => new Map(prev).set(lesson.id, updatedProgress));
        
        // Revert after delay - use lesson's initialFen, not previousFen
        setTimeout(() => {
          const lesson = practice.lessons[currentLessonIndex];
          const resetGame = new Chess(lesson.initialFen);
          setChess(resetGame);
          setCurrentFen(lesson.initialFen); // Reset to lesson's initial Chess960 FEN
          setWrongMoveSquares(null);
          setShowWrongFeedback(false);
          setErrorMessage('Try again');
          
          // Allow viewing solution after delay
          setTimeout(() => {
            setCanViewSolution(true);
          }, 2000);
        }, 500);
        return;
      }

      // Correct move!
      const newFen = chess.fen();
      setCurrentFen(newFen); // After a move, use chess.fen() as it's the new position
      setShowCorrectFeedback(true);
      setErrorMessage(null);
      setWrongMoveSquares(null);
      
      // Update progress
      const isComplete = validation.isComplete;
      const updatedProgress: LessonProgress = {
        ...currentProgress,
        currentMoveIndex: currentProgress.currentMoveIndex + 1,
        correctMoves: currentProgress.correctMoves + 1,
        completed: isComplete,
      };
      setLessonProgress(prev => new Map(prev).set(lesson.id, updatedProgress));

      // Hide feedback after delay
      setTimeout(() => setShowCorrectFeedback(false), 1500);

      // If lesson is complete, show completion message
      if (isComplete) {
        setTimeout(() => {
          setErrorMessage(null);
        }, 2000);
      }
    } catch (error) {
      setErrorMessage('Invalid move');
      setTimeout(() => setErrorMessage(null), 2000);
    }
  };

  const handleShowHint = () => {
    if (!currentProgress) return;
    const lesson = practice?.lessons[currentLessonIndex];
    if (!lesson || hintIndex >= lesson.hints.length) return;
    
    setShowHint(true);
    setHintIndex(hintIndex + 1);
    
    // Update progress
    const updatedProgress = {
      ...currentProgress,
      hintsUsed: currentProgress.hintsUsed + 1,
    };
    setLessonProgress(prev => new Map(prev).set(lesson.id, updatedProgress));
  };

  const handleViewSolution = () => {
    if (!chess || !currentProgress || !practice) return;
    
    const lesson = practice.lessons[currentLessonIndex];
    if (!lesson.solution) return;
    
    // Replay solution from beginning
    const solutionChess = new Chess(lesson.initialFen);
    const solutionMoves = currentLessonSolution;
    
    let moveIndex = 0;
    const replayMove = () => {
      if (moveIndex >= solutionMoves.length) {
        // Solution complete
        const updatedProgress: LessonProgress = {
          ...currentProgress,
          completed: true,
          currentMoveIndex: solutionMoves.length,
        };
        setLessonProgress(prev => new Map(prev).set(lesson.id, updatedProgress));
        return;
      }
      
      const move = solutionMoves[moveIndex];
      const from = move.slice(0, 2);
      const to = move.slice(2, 4);
      const promotion = move.length > 4 ? move[4] : undefined;
      
      try {
        solutionChess.move({ from, to, promotion: promotion as any });
        setCurrentFen(solutionChess.fen());
        setChess(new Chess(solutionChess.fen()));
        moveIndex++;
        
        setTimeout(replayMove, 800);
      } catch (error) {
        console.error('Error replaying solution:', error);
      }
    };
    
    replayMove();
    setCanViewSolution(false);
  };

  const handleNextLesson = () => {
    if (!practice) return;
    
    // Check if current lesson is completed
    const currentLesson = practice.lessons[currentLessonIndex];
    const progress = lessonProgress.get(currentLesson.id);
    
    if (progress && !progress.completed && currentLesson.solution) {
      setErrorMessage('Complete this lesson before continuing');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    
    if (currentLessonIndex < practice.lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else {
      // Practice completed - calculate score and submit
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!session || !practice) return;
    
    // Calculate final score
    let totalCorrectMoves = 0;
    let totalWrongAttempts = 0;
    let totalHintsUsed = 0;
    let lessonsCompleted = 0;
    
    practice.lessons.forEach(lesson => {
      const progress = lessonProgress.get(lesson.id);
      if (progress) {
        totalCorrectMoves += progress.correctMoves;
        totalWrongAttempts += progress.wrongAttempts;
        totalHintsUsed += progress.hintsUsed;
        if (progress.completed) {
          lessonsCompleted++;
        }
      }
    });
    
    const totalMoves = totalCorrectMoves + totalWrongAttempts;
    const score = calculatePracticeScore(
      lessonsCompleted,
      practice.lessons.length,
      totalMoves,
      totalCorrectMoves,
      totalWrongAttempts,
      totalHintsUsed
    );
    
    try {
      const response = await fetch(`/api/practice/${practiceId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      if (response.ok) {
        setCompleted(true);
        const data = await response.json();
        if (data.practice) {
          setPractice(data.practice);
        }
      }
    } catch (error) {
      console.error('Error completing practice:', error);
    }
  };

  const currentLesson = practice?.lessons[currentLessonIndex];
  const progressPercent = practice
    ? Math.round(
        (Array.from(lessonProgress.values()).filter(p => p.completed).length /
          practice.lessons.length) *
          100
      )
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1814] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!practice) {
    return (
      <div className="min-h-screen bg-[#1a1814] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#a0958a] light:text-[#6b6560] text-lg mb-4">Practice not found</p>
          <Link href="/practice" className="text-[#f97316] hover:text-[#ea580c]">
            Back to Practices
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/practice"
            className="inline-flex items-center gap-2 text-[#a0958a] light:text-[#6b6560] hover:text-white light:hover:text-black mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Practices
          </Link>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent">
                  {practice.title}
                </h1>
                {completed && <CheckCircle2 className="w-6 h-6 text-green-500" />}
              </div>
              {practice.description && (
                <p className="text-[#b6aea2] light:text-[#5a5449] mb-2">{practice.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-[#a0958a] light:text-[#5a5449]">
                <span>{CATEGORY_LABELS[practice.category] || practice.category}</span>
                <span>•</span>
                <span>{DIFFICULTY_LABELS[practice.difficulty] || practice.difficulty}</span>
                <span>•</span>
                <span>Lesson {currentLessonIndex + 1} of {practice.lessons.length}</span>
                {practice.userScore !== null && (
                  <>
                    <span>•</span>
                    <span>Score: {practice.userScore}%</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#a0958a] light:text-[#6b6560]">Progress</span>
              <span className="text-sm font-semibold text-white light:text-black">{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#33302c] light:bg-[#e8e3d8] rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-orange-300 to-orange-400 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Lessons List */}
          <div className="lg:col-span-1">
            <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4">
              <h2 className="text-xl font-semibold text-white light:text-black mb-4">Lessons</h2>
              <div className="space-y-2">
                {practice.lessons.map((lesson, index) => {
                  const progress = lessonProgress.get(lesson.id);
                  const isCompleted = progress?.completed || false;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setCurrentLessonIndex(index)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors relative ${
                        index === currentLessonIndex
                          ? 'bg-orange-400 text-black'
                          : 'bg-[#33302c] light:bg-[#f0ebe0] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#3a3632] light:hover:bg-[#e8e3d8]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{lesson.title}</span>
                        {isCompleted && (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center: Board and Instructions */}
          <div className="lg:col-span-2">
            {currentLesson && (
              <>
                <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4 mb-4">
                  <h2 className="text-xl font-semibold text-white light:text-black mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    {currentLesson.title}
                  </h2>
                  <div className="prose prose-invert light:prose-dark max-w-none mb-4">
                    <p className="text-[#c1b9ad] light:text-[#4a453e] whitespace-pre-wrap">
                      {currentLesson.instructions}
                    </p>
                  </div>
                  
                  {/* Feedback Messages */}
                  {showCorrectFeedback && (
                    <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2 animate-fadeIn">
                      <Check className="w-5 h-5 text-green-400" />
                      <span className="text-green-300 font-semibold">Correct!</span>
                    </div>
                  )}
                  
                  {showWrongFeedback && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 animate-fadeIn">
                      <X className="w-5 h-5 text-red-400" />
                      <span className="text-red-300 font-semibold">Not the right move</span>
                    </div>
                  )}
                  
                  {errorMessage && (
                    <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                      <span className="text-yellow-300">{errorMessage}</span>
                    </div>
                  )}
                  
                  {currentFen && practice?.lessons[currentLessonIndex]?.initialFen && (
                    <div className="flex justify-center mb-4 relative">
                      {(() => {
                        const lesson = practice.lessons[currentLessonIndex];
                        const isChess960 = !currentFen.includes('rnbqkbnr/pppppppp');
                        if (!isChess960 && currentFen) {
                          console.error('[Practice] WARNING: Rendering standard chess position instead of Chess960!', {
                            currentFen,
                            lessonInitialFen: lesson.initialFen,
                          });
                        }
                        return null;
                      })()}
                      <Chess960Board
                        fen={currentFen}
                        orientation="white"
                        width={400}
                        onMove={handleMove}
                        showCoordinates={true}
                        readOnly={currentProgress?.completed || false}
                        lastMove={wrongMoveSquares ? wrongMoveSquares : undefined}
                      />
                      {wrongMoveSquares && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div
                            className="absolute bg-red-500/30 rounded"
                            style={{
                              left: `${((wrongMoveSquares[0].charCodeAt(0) - 97) * 50)}px`,
                              top: `${((8 - parseInt(wrongMoveSquares[0][1])) * 50)}px`,
                              width: '50px',
                              height: '50px',
                            }}
                          />
                          <div
                            className="absolute bg-red-500/30 rounded"
                            style={{
                              left: `${((wrongMoveSquares[1].charCodeAt(0) - 97) * 50)}px`,
                              top: `${((8 - parseInt(wrongMoveSquares[1][1])) * 50)}px`,
                              width: '50px',
                              height: '50px',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Lesson Stats */}
                  {currentProgress && (
                    <div className="mb-4 p-3 bg-[#33302c] light:bg-[#f0ebe0] rounded-lg">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-[#a0958a] light:text-[#6b6460]">Correct</div>
                          <div className="text-white light:text-black font-semibold">
                            {currentProgress.correctMoves}
                          </div>
                        </div>
                        <div>
                          <div className="text-[#a0958a] light:text-[#6b6460]">Wrong</div>
                          <div className="text-white light:text-black font-semibold">
                            {currentProgress.wrongAttempts}
                          </div>
                        </div>
                        <div>
                          <div className="text-[#a0958a] light:text-[#6b6460]">Hints</div>
                          <div className="text-white light:text-black font-semibold">
                            {currentProgress.hintsUsed}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {currentLesson.hints.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={handleShowHint}
                        className="flex items-center gap-2 px-4 py-2 bg-[#33302c] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] rounded-lg hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={hintIndex >= currentLesson.hints.length || currentProgress?.completed}
                      >
                        <Lightbulb className="w-4 h-4" />
                        Show Hint {hintIndex > 0 ? `${hintIndex}/${currentLesson.hints.length}` : ''}
                      </button>
                      {showHint && hintIndex > 0 && (
                        <div className="mt-2 p-3 bg-[#33302c] light:bg-[#f0ebe0] rounded-lg">
                          <p className="text-sm text-[#c1b9ad] light:text-[#4a453e]">
                            {currentLesson.hints[hintIndex - 1]}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* View Solution Button */}
                  {canViewSolution && currentLesson.solution && !currentProgress?.completed && (
                    <div className="mt-4">
                      <button
                        onClick={handleViewSolution}
                        className="w-full px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 rounded-lg hover:bg-yellow-500/30 transition-colors"
                      >
                        View Solution
                      </button>
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleNextLesson}
                      disabled={!currentProgress?.completed && currentLesson.solution}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {currentLessonIndex < practice.lessons.length - 1 ? 'Next Lesson' : 'Complete Practice'}
                      <Trophy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
