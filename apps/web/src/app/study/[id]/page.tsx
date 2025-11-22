'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Chess960Board } from '@chess960/board';
import { Chess } from 'chess.js';
import { ArrowLeft, Heart, Eye, MessageSquare, Edit, Trash2, Plus, Save, ChevronLeft, ChevronRight, SkipBack, SkipForward, Pencil, List, Sparkles, GitBranch, Upload, Download, Tag, X } from 'lucide-react';

interface Study {
  id: string;
  title: string;
  description: string | null;
  owner: {
    id: string;
    handle: string;
    image: string | null;
  };
  isPublic: boolean;
  tags?: string[];
  likes: number;
  views: number;
  isLiked: boolean;
  isOwner: boolean;
  chapters: Chapter[];
  comments: Comment[];
  likeCount: number;
}

interface Chapter {
  id: string;
  name: string;
  order: number;
  initialFen: string;
  pgn: string | null;
}

interface Comment {
  id: string;
  movePly: number | null;
  text: string;
  createdAt: string;
  user: {
    id: string;
    handle: string;
    image: string | null;
  };
}

export default function StudyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const studyId = params.id as string;

  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [currentFen, setCurrentFen] = useState<string>('');
  const [chess, setChess] = useState<Chess | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [boardWidth, setBoardWidth] = useState<number>(480);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(0);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editChapterName, setEditChapterName] = useState('');
  const [editChapterFen, setEditChapterFen] = useState('');
  const [showMoveList, setShowMoveList] = useState(true);
  const [commentingOnMove, setCommentingOnMove] = useState<number | null>(null);
  const [moveCommentText, setMoveCommentText] = useState('');
  const [moveGlyphs, setMoveGlyphs] = useState<Map<number, string>>(new Map()); // movePly -> glyph
  const [editingGlyph, setEditingGlyph] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null); // commentId
  const [editCommentText, setEditCommentText] = useState('');
  const [variations, setVariations] = useState<Map<number, string[]>>(new Map()); // movePly -> array of UCI moves
  const [creatingVariation, setCreatingVariation] = useState<number | null>(null);
  const [variationMoves, setVariationMoves] = useState<string[]>([]);
  const [boardArrows, setBoardArrows] = useState<Array<{ startSquare: string; endSquare: string; color?: string }>>([]);
  const [drawingArrow, setDrawingArrow] = useState(false);
  const [showImportPGN, setShowImportPGN] = useState(false);
  const [importPGNText, setImportPGNText] = useState('');
  const [editingTags, setEditingTags] = useState(false);
  const [studyTags, setStudyTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [draggedChapter, setDraggedChapter] = useState<string | null>(null);
  
  // Calculate board width based on screen size - match puzzle page
  useEffect(() => {
    const updateBoardWidth = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth < 1024;
        const width = isMobile ? Math.min(Math.floor(window.innerWidth * 0.85), 360) : 480;
        setBoardWidth(width);
      }
    };
    
    updateBoardWidth();
    window.addEventListener('resize', updateBoardWidth);
    return () => window.removeEventListener('resize', updateBoardWidth);
  }, []);

  useEffect(() => {
    if (studyId) {
      fetchStudy();
    }
  }, [studyId]);

  // Close glyph dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingGlyph !== null) {
        const target = e.target as HTMLElement;
        if (!target.closest('.glyph-dropdown')) {
          setEditingGlyph(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingGlyph]);

  useEffect(() => {
    if (selectedChapter) {
      const game = new Chess(selectedChapter.initialFen);
      
      // Load PGN if it exists
      if (selectedChapter.pgn) {
        try {
          game.loadPgn(selectedChapter.pgn);
          const history = game.history({ verbose: true });
          const uciMoves = history.map(m => `${m.from}${m.to}${m.promotion || ''}`);
          setMoveHistory(uciMoves);
          setCurrentMoveIndex(uciMoves.length); // Start at the end
        } catch (error) {
          console.error('Error loading PGN:', error);
          setMoveHistory([]);
          setCurrentMoveIndex(0);
        }
      } else {
        setMoveHistory([]);
        setCurrentMoveIndex(0);
      }
      
      setChess(game);
      setCurrentFen(game.fen());
    }
  }, [selectedChapter?.id]); // Only re-run when chapter ID changes

  const fetchStudy = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/study/${studyId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/study');
          return;
        }
        throw new Error('Failed to fetch study');
      }
      const data = await response.json();
      setStudy(data.study);
      setStudyTags(data.study.tags || []);
      if (data.study.chapters.length > 0) {
        setSelectedChapter(data.study.chapters[0]);
      }
    } catch (error) {
      console.error('Error fetching study:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!session) return;
    try {
      const response = await fetch(`/api/study/${studyId}/like`, {
        method: 'POST',
      });
      const data = await response.json();
      if (study) {
        setStudy({
          ...study,
          isLiked: data.liked,
          likes: data.liked ? study.likes + 1 : study.likes - 1,
          likeCount: data.liked ? study.likeCount + 1 : study.likeCount - 1,
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !session) return;
    try {
      const response = await fetch(`/api/study/${studyId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText }),
      });
      const data = await response.json();
      if (study) {
        setStudy({
          ...study,
          comments: [...study.comments, data.comment],
        });
      }
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleAddMoveComment = async (movePly: number) => {
    if (!moveCommentText.trim() || !session) return;
    try {
      const response = await fetch(`/api/study/${studyId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: moveCommentText, movePly }),
      });
      const data = await response.json();
      if (study) {
        setStudy({
          ...study,
          comments: [...study.comments, data.comment],
        });
      }
      setMoveCommentText('');
      setCommentingOnMove(null);
    } catch (error) {
      console.error('Error adding move comment:', error);
    }
  };

  const getCommentsForMove = (movePly: number) => {
    return study?.comments.filter(c => c.movePly === movePly) || [];
  };

  const handleEditComment = (commentId: string, currentText: string) => {
    setEditingComment(commentId);
    setEditCommentText(currentText);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editCommentText.trim() || !session) return;
    try {
      const response = await fetch(`/api/study/${studyId}/comment/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editCommentText }),
      });
      const data = await response.json();
      if (study && data.comment) {
        setStudy({
          ...study,
          comments: study.comments.map(c => 
            c.id === commentId ? data.comment : c
          ),
        });
      }
      setEditingComment(null);
      setEditCommentText('');
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!session) return;
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      const response = await fetch(`/api/study/${studyId}/comment/${commentId}`, {
        method: 'DELETE',
      });
      if (response.ok && study) {
        setStudy({
          ...study,
          comments: study.comments.filter(c => c.id !== commentId),
        });
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const canEditComment = (comment: Comment): boolean => {
    return session?.user?.id === comment.user.id || study?.isOwner || false;
  };

  const glyphOptions = [
    { symbol: '!', label: 'Good move', nag: '$1' },
    { symbol: '?', label: 'Poor move', nag: '$2' },
    { symbol: '!!', label: 'Excellent move', nag: '$3' },
    { symbol: '??', label: 'Blunder', nag: '$4' },
    { symbol: '!?', label: 'Interesting move', nag: '$5' },
    { symbol: '?!', label: 'Questionable move', nag: '$6' },
  ];

  const handleSetGlyph = (movePly: number, glyph: string) => {
    const newGlyphs = new Map(moveGlyphs);
    if (newGlyphs.get(movePly) === glyph) {
      // Remove glyph if clicking the same one
      newGlyphs.delete(movePly);
    } else {
      newGlyphs.set(movePly, glyph);
    }
    setMoveGlyphs(newGlyphs);
    setEditingGlyph(null);
    
    // TODO: Save glyphs to PGN
    // This would require updating the PGN string with NAG annotations
  };

  const getGlyphForMove = (movePly: number): string | null => {
    return moveGlyphs.get(movePly) || null;
  };

  const formatPgnWithGlyphs = (pgn: string): string => {
    if (!pgn || moveGlyphs.size === 0) return pgn;
    
    // Parse PGN and add glyphs
    const chess = new Chess(selectedChapter?.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    try {
      chess.loadPgn(pgn);
      const history = chess.history({ verbose: true });
      
      // Rebuild PGN with glyphs
      const game = new Chess(selectedChapter?.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      let pgnWithGlyphs = '';
      
      history.forEach((move, index) => {
        const movePly = index + 1;
        const glyph = getGlyphForMove(movePly);
        const moveNumber = Math.floor(index / 2) + 1;
        const isWhite = index % 2 === 0;
        
        if (isWhite) {
          pgnWithGlyphs += `${moveNumber}. `;
        }
        
        game.move(move);
        pgnWithGlyphs += move.san;
        
        if (glyph) {
          pgnWithGlyphs += glyph;
        }
        
        pgnWithGlyphs += ' ';
      });
      
      return pgnWithGlyphs.trim();
    } catch (error) {
      return pgn;
    }
  };

  const handleStartVariation = (movePly: number) => {
    setCreatingVariation(movePly);
    setVariationMoves([]);
  };

  const handleAddVariationMove = async (from: string, to: string, promotion?: string) => {
    if (!creatingVariation || !selectedChapter) return;
    
    try {
      // Create a temporary chess instance at the variation start position
      const tempChess = new Chess(selectedChapter.initialFen);
      // Apply moves up to the variation start
      const movesBeforeVariation = moveHistory.slice(0, creatingVariation - 1);
      for (const uci of movesBeforeVariation) {
        try {
          tempChess.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
          });
        } catch (e) {
          console.error('Error applying move before variation:', uci, e);
          return;
        }
      }
      
      // Apply existing variation moves
      for (const uci of variationMoves) {
        try {
          tempChess.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
          });
        } catch (e) {
          console.error('Error applying existing variation move:', uci, e);
          return;
        }
      }
      
      const move = tempChess.move({ from, to, promotion: promotion as any });
      if (!move) {
        console.error('Invalid variation move');
        return;
      }
      
      const newMove = `${from}${to}${promotion || ''}`;
      const newVariationMoves = [...variationMoves, newMove];
      setVariationMoves(newVariationMoves);
      
      // Update current position for next move
      setCurrentFen(tempChess.fen());
      setChess(tempChess);
    } catch (error) {
      console.error('Invalid variation move:', error);
    }
  };

  const handleSaveVariation = () => {
    if (!creatingVariation || variationMoves.length === 0) return;
    
    const newVariations = new Map(variations);
    newVariations.set(creatingVariation, variationMoves);
    setVariations(newVariations);
    setCreatingVariation(null);
    setVariationMoves([]);
    
    // TODO: Save variation to PGN
  };

  const handleCancelVariation = () => {
    const variationStart = creatingVariation;
    setCreatingVariation(null);
    setVariationMoves([]);
    // Restore position to where variation started
    if (selectedChapter && variationStart !== null) {
      goToMove(variationStart - 1);
    }
  };

  const getVariationsForMove = (movePly: number): string[] | null => {
    return variations.get(movePly) || null;
  };

  const handleExportPGN = () => {
    if (!selectedChapter || !selectedChapter.pgn) {
      alert('No PGN to export');
      return;
    }

    const pgnWithGlyphs = formatPgnWithGlyphs(selectedChapter.pgn);
    const fullPGN = `[Event "Study: ${study?.title || 'Untitled'}"]
[Site "Chess960"]
[Date "${new Date().toISOString().split('T')[0]}"]
[Round "-"]
[White "?"]
[Black "?"]
[Result "*"]
[FEN "${selectedChapter.initialFen}"]

${pgnWithGlyphs}`;

    const blob = new Blob([fullPGN], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${study?.title || 'study'}-${selectedChapter.name || 'chapter'}.pgn`.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportPGN = async () => {
    if (!importPGNText.trim() || !selectedChapter || !study?.isOwner) return;

    try {
      const game = new Chess(selectedChapter.initialFen);
      game.loadPgn(importPGNText.trim());
      
      const pgn = game.pgn();
      const history = game.history({ verbose: true });
      const uciMoves = history.map(m => `${m.from}${m.to}${m.promotion || ''}`);
      
      // Save PGN to chapter
      await saveChapterPgn(pgn);
      
      // Update move history
      setMoveHistory(uciMoves);
      setCurrentMoveIndex(uciMoves.length);
      setCurrentFen(game.fen());
      setChess(game);
      
      setImportPGNText('');
      setShowImportPGN(false);
    } catch (error) {
      console.error('Error importing PGN:', error);
      alert('Failed to import PGN. Please check the format.');
    }
  };

  const handleImportPGNFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChapter || !study?.isOwner) return;

    try {
      const text = await file.text();
      setImportPGNText(text);
      // Auto-import after reading file
      setTimeout(() => {
        handleImportPGN();
      }, 100);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file');
    }
  };

  const handleAddTag = async (tag: string) => {
    if (!tag.trim() || studyTags.includes(tag.trim())) return;
    
    const newTags = [...studyTags, tag.trim()];
    await handleUpdateTags(newTags);
  };

  const handleUpdateTags = async (tags: string[]) => {
    if (!study?.isOwner) return;
    
    try {
      const response = await fetch(`/api/study/${studyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (study) {
          setStudy({ ...study, tags: data.study.tags || [] });
        }
        setStudyTags(data.study.tags || []);
      }
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const handleReorderChapters = async (draggedId: string, targetId: string) => {
    if (!study?.isOwner) return;
    
    const draggedIndex = study.chapters.findIndex(c => c.id === draggedId);
    const targetIndex = study.chapters.findIndex(c => c.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newChapters = [...study.chapters];
    const [removed] = newChapters.splice(draggedIndex, 1);
    newChapters.splice(targetIndex, 0, removed);
    
    // Update order values
    const updates = newChapters.map((chapter, index) => ({
      chapterId: chapter.id,
      order: index,
    }));
    
    try {
      // Update all chapters in parallel
      await Promise.all(
        updates.map(update =>
          fetch(`/api/study/${studyId}/chapter`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
          })
        )
      );
      
      // Refresh study
      await fetchStudy();
    } catch (error) {
      console.error('Error reordering chapters:', error);
      alert('Failed to reorder chapters');
    }
  };

  const handleDelete = async () => {
    if (!study?.isOwner) return;
    try {
      const response = await fetch(`/api/study/${studyId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        router.push('/study');
      }
    } catch (error) {
      console.error('Error deleting study:', error);
    }
  };

  const handleMove = async (from: string, to: string, promotion?: string) => {
    if (!chess || !selectedChapter || !study?.isOwner) return;
    
    // If we're not at the end of the move history, we can't add new moves
    // User needs to navigate to the end first
    if (currentMoveIndex < moveHistory.length) {
      return;
    }
    
    try {
      const move = chess.move({ from, to, promotion: promotion as any });
      if (!move) {
        console.error('Invalid move');
        return;
      }
      
      const newFen = chess.fen();
      setCurrentFen(newFen);
      
      // Update move history
      const newMove = `${from}${to}${promotion || ''}`;
      const newHistory = [...moveHistory, newMove];
      setMoveHistory(newHistory);
      setCurrentMoveIndex(newHistory.length);
      
      // Save PGN to chapter
      await saveChapterPgn(chess.pgn());
    } catch (error) {
      console.error('Invalid move:', error);
    }
  };

  const saveChapterPgn = async (pgn: string) => {
    if (!selectedChapter || !study?.isOwner || saving) return;
    
    try {
      setSaving(true);
      const response = await fetch(`/api/study/${studyId}/chapter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: selectedChapter.id,
          pgn: pgn,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save PGN');
      }
      
      // Update local chapter
      if (study && selectedChapter) {
        const updatedChapters = study.chapters.map(ch => 
          ch.id === selectedChapter.id ? { ...ch, pgn } : ch
        );
        setStudy({ ...study, chapters: updatedChapters });
        setSelectedChapter({ ...selectedChapter, pgn });
      }
    } catch (error) {
      console.error('Error saving PGN:', error);
    } finally {
      setSaving(false);
    }
  };

  const goToMove = (index: number) => {
    if (!chess || !selectedChapter) return;
    
    const game = new Chess(selectedChapter.initialFen);
    const moves = moveHistory.slice(0, index);
    
    for (const move of moves) {
      try {
        game.move({
          from: move.slice(0, 2),
          to: move.slice(2, 4),
          promotion: move.length > 4 ? move[4] : undefined,
        });
      } catch (error) {
        console.error('Error playing move:', error);
        break;
      }
    }
    
    setChess(game);
    setCurrentFen(game.fen());
    setCurrentMoveIndex(index);
  };

  const goToFirst = () => goToMove(0);
  const goToPrevious = () => {
    if (currentMoveIndex > 0) {
      goToMove(currentMoveIndex - 1);
    }
  };
  const goToNext = () => {
    if (currentMoveIndex < moveHistory.length) {
      goToMove(currentMoveIndex + 1);
    }
  };
  const goToLast = () => goToMove(moveHistory.length);

  const handleAddChapter = async () => {
    if (!newChapterName.trim() || !study?.isOwner) return;
    
    try {
      const standardStartingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const response = await fetch(`/api/study/${studyId}/chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChapterName.trim(),
          initialFen: standardStartingFen,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create chapter');
      }
      
      const data = await response.json();
      
      // Refresh study to get updated chapters
      await fetchStudy();
      
      // Select the new chapter
      if (study) {
        const updatedStudy = { ...study, chapters: [...study.chapters, data.chapter] };
        setStudy(updatedStudy);
        setSelectedChapter(data.chapter);
      }
      
      setNewChapterName('');
      setShowAddChapter(false);
    } catch (error) {
      console.error('Error adding chapter:', error);
      alert('Failed to add chapter. Please try again.');
    }
  };

  const handleStartEditChapter = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setEditChapterName(chapter.name);
    setEditChapterFen(chapter.initialFen);
  };

  const handleSaveEditChapter = async () => {
    if (!editingChapter || !editChapterName.trim() || !editChapterFen.trim() || !study?.isOwner) return;
    
    try {
      const response = await fetch(`/api/study/${studyId}/chapter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: editingChapter.id,
          name: editChapterName.trim(),
          initialFen: editChapterFen.trim(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update chapter');
      }
      
      const data = await response.json();
      
      // Refresh study
      await fetchStudy();
      
      // Update selected chapter if it was the one being edited
      if (selectedChapter?.id === editingChapter.id) {
        setSelectedChapter(data.chapter);
      }
      
      setEditingChapter(null);
      setEditChapterName('');
      setEditChapterFen('');
    } catch (error) {
      console.error('Error updating chapter:', error);
      alert('Failed to update chapter. Please try again.');
    }
  };

  const handleCancelEditChapter = () => {
    setEditingChapter(null);
    setEditChapterName('');
    setEditChapterFen('');
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!study?.isOwner || !confirm('Are you sure you want to delete this chapter?')) return;
    
    try {
      const response = await fetch(`/api/study/${studyId}/chapter?chapterId=${chapterId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete chapter');
      }
      
      // Refresh study
      await fetchStudy();
      
      // Clear selection if deleted chapter was selected
      if (selectedChapter?.id === chapterId) {
        setSelectedChapter(null);
      }
    } catch (error) {
      console.error('Error deleting chapter:', error);
      alert('Failed to delete chapter. Please try again.');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!study?.isOwner) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't handle if typing in input
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToFirst();
      } else if (e.key === 'End') {
        e.preventDefault();
        goToLast();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMoveIndex, moveHistory.length, study?.isOwner]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1814] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="min-h-screen bg-[#1a1814] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#a0958a] light:text-[#6b6560] text-lg mb-4">Study not found</p>
          <Link href="/study" className="text-[#f97316] hover:text-[#ea580c]">
            Back to Studies
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
            href="/study"
            className="inline-flex items-center gap-2 text-[#a0958a] light:text-[#6b6560] hover:text-white light:hover:text-black mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Studies
          </Link>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent mb-2">{study.title}</h1>
              {study.description && (
                <p className="text-[#b6aea2] light:text-[#5a5449]">{study.description}</p>
              )}
              {/* Tags */}
              {(studyTags.length > 0 || editingTags) && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {studyTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#35322e] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] rounded-lg text-xs text-white light:text-black"
                    >
                      <Tag className="w-3 h-3 text-orange-400" />
                      {tag}
                      {study.isOwner && (
                        <button
                          onClick={() => {
                            const newTags = studyTags.filter((_, i) => i !== idx);
                            handleUpdateTags(newTags);
                          }}
                          className="ml-1 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {editingTags && study.isOwner && (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newTag.trim()) {
                            handleAddTag(newTag.trim());
                            setNewTag('');
                          } else if (e.key === 'Escape') {
                            setEditingTags(false);
                            setNewTag('');
                          }
                        }}
                        placeholder="Add tag..."
                        className="px-2 py-1 bg-[#33302c] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:ring-1 focus:ring-orange-400 text-xs"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          setEditingTags(false);
                          setNewTag('');
                        }}
                        className="p-1 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                      >
                        <X className="w-3 h-3 text-[#a0958a] light:text-[#6b6560]" />
                      </button>
                    </div>
                  )}
                  {!editingTags && study.isOwner && (
                    <button
                      onClick={() => setEditingTags(true)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#2a2720] light:bg-[#f0ebe0] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] border border-[#474239] light:border-[#d4caba] rounded-lg text-xs text-[#a0958a] light:text-[#6b6560] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add Tag
                    </button>
                  )}
                </div>
              )}
              {studyTags.length === 0 && !editingTags && study.isOwner && (
                <button
                  onClick={() => setEditingTags(true)}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-[#2a2720] light:bg-[#f0ebe0] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] border border-[#474239] light:border-[#d4caba] rounded-lg text-xs text-[#a0958a] light:text-[#6b6560] transition-colors"
                >
                  <Tag className="w-3 h-3" />
                  Add Tags
                </button>
              )}
              <div className="flex items-center gap-4 mt-4 text-sm text-[#a0958a] light:text-[#6b6560]">
                <div className="flex items-center gap-1">
                  {study.owner.image && (
                    <img src={study.owner.image} alt={study.owner.handle} className="w-5 h-5 rounded-full" />
                  )}
                  <span>{study.owner.handle}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {study.views}
                </div>
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1 ${study.isLiked ? 'text-[#f97316]' : ''}`}
                  disabled={!session}
                >
                  <Heart className={`w-4 h-4 ${study.isLiked ? 'fill-[#f97316]' : ''}`} />
                  {study.likeCount}
                </button>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  {study.comments.length}
                </div>
              </div>
            </div>
            {study.isOwner && (
              <div className="flex gap-2">
                <Link
                  href={`/study/${studyId}/edit`}
                  className="flex items-center gap-2 px-6 py-3 bg-[#35322e] light:bg-white hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] hover:border-orange-300/50 text-white light:text-black rounded-lg font-semibold transition-all duration-200"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Link>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-red-500/20 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors text-red-400 font-semibold"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-6 max-w-md">
              <h3 className="text-xl font-semibold text-white light:text-black mb-4">Delete Study?</h3>
              <p className="text-[#a0958a] light:text-[#6b6560] mb-6">
                Are you sure you want to delete this study? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-[#33302c] light:bg-[#f0ebe0] rounded-lg hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Chapters List + Move List */}
          <div className="lg:col-span-3 order-1 lg:order-1 space-y-4">
            <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white light:text-black">Chapters</h2>
                {study.isOwner && (
                  <button
                    onClick={() => setShowAddChapter(!showAddChapter)}
                    className="p-1.5 rounded-lg bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] transition-colors"
                    title="Add Chapter"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {showAddChapter && study.isOwner && (
                <div className="mb-4 p-3 bg-[#2a2720] light:bg-[#f0ebe0] rounded-lg border border-[#474239] light:border-[#d4caba]">
                  <input
                    type="text"
                    value={newChapterName}
                    onChange={(e) => setNewChapterName(e.target.value)}
                    placeholder="Chapter name..."
                    className="w-full px-3 py-2 mb-2 bg-[#33302c] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddChapter()}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddChapter}
                      className="flex-1 px-3 py-1.5 bg-orange-400 hover:bg-orange-500 text-black rounded-lg transition-colors text-sm font-medium"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddChapter(false);
                        setNewChapterName('');
                      }}
                      className="px-3 py-1.5 bg-[#33302c] light:bg-white hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
                {study.chapters.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-[#a0958a] light:text-[#6b6560]">No chapters yet</p>
                    {study.isOwner && (
                      <p className="text-xs text-[#6b6460] light:text-[#a0958a] mt-2">Click + to add one</p>
                    )}
                  </div>
                ) : (
                  study.chapters.map((chapter) => (
                    editingChapter?.id === chapter.id ? (
                      <div key={chapter.id} className="p-3 bg-[#2a2720] light:bg-[#f0ebe0] rounded-lg border border-[#474239] light:border-[#d4caba]">
                        <input
                          type="text"
                          value={editChapterName}
                          onChange={(e) => setEditChapterName(e.target.value)}
                          placeholder="Chapter name..."
                          className="w-full px-3 py-2 mb-2 bg-[#33302c] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editChapterFen}
                          onChange={(e) => setEditChapterFen(e.target.value)}
                          placeholder="Initial FEN..."
                          className="w-full px-3 py-2 mb-2 bg-[#33302c] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm font-mono text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEditChapter}
                            className="flex-1 px-3 py-1.5 bg-orange-400 hover:bg-orange-500 text-black rounded-lg transition-colors text-sm font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEditChapter}
                            className="px-3 py-1.5 bg-[#33302c] light:bg-white hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded-lg transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                    key={chapter.id}
                        draggable={study.isOwner}
                        onDragStart={(e) => {
                          setDraggedChapter(chapter.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedChapter && draggedChapter !== chapter.id) {
                            handleReorderChapters(draggedChapter, chapter.id);
                          }
                          setDraggedChapter(null);
                        }}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${study.isOwner ? 'cursor-move' : 'cursor-default'} ${
                      selectedChapter?.id === chapter.id
                        ? 'bg-[#f97316] text-white'
                        : 'bg-[#33302c] light:bg-[#f0ebe0] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#3a3632] light:hover:bg-[#e8e3d8]'
                    } ${draggedChapter === chapter.id ? 'opacity-50' : ''}`}
                      >
                        <button
                          onClick={() => setSelectedChapter(chapter)}
                          className="flex-1 text-left"
                  >
                    {chapter.name}
                        </button>
                        {study.isOwner && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditChapter(chapter);
                              }}
                              className="p-1 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                              title="Edit chapter"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteChapter(chapter.id);
                              }}
                              className="p-1 rounded hover:bg-red-500/20 transition-colors"
                              title="Delete chapter"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  ))
                )}
              </div>
            </div>

            {/* Move List */}
            {selectedChapter && moveHistory.length > 0 && (
              <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white light:text-black flex items-center gap-2">
                    <List className="w-5 h-5" />
                    Moves
                  </h2>
                  <button
                    onClick={() => setShowMoveList(!showMoveList)}
                    className="text-xs text-[#a0958a] light:text-[#6b6560] hover:text-white light:hover:text-black"
                  >
                    {showMoveList ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showMoveList && (
                  <div className="max-h-64 sm:max-h-96 overflow-y-auto space-y-1">
                    {/* Custom Move List with Comments */}
                    {(() => {
                      const chess = new Chess(selectedChapter.initialFen);
                      const parsedMoves: Array<{ uci: string; san: string; moveNumber: number; isWhite: boolean; index: number }> = [];
                      
                      moveHistory.forEach((uci, index) => {
                        try {
                          const moveNumber = Math.floor(index / 2) + 1;
                          const isWhite = index % 2 === 0;
                          const move = chess.move({
                            from: uci.slice(0, 2),
                            to: uci.slice(2, 4),
                            promotion: uci.length > 4 ? uci[4] : undefined,
                          });
                          if (move) {
                            parsedMoves.push({ uci, san: move.san, moveNumber, isWhite, index });
                          }
                        } catch (error) {
                          console.error('Failed to parse move:', uci, error);
                        }
                      });

                      const movePairs: Array<{ white: typeof parsedMoves[0]; black?: typeof parsedMoves[0]; moveNumber: number }> = [];
                      for (let i = 0; i < parsedMoves.length; i += 2) {
                        movePairs.push({
                          white: parsedMoves[i],
                          black: parsedMoves[i + 1],
                          moveNumber: parsedMoves[i].moveNumber,
                        });
                      }

                      return movePairs.map((pair, pairIndex) => {
                        const whiteMovePly = pair.white.index + 1;
                        const blackMovePly = pair.black ? pair.black.index + 1 : null;
                        const whiteComments = getCommentsForMove(whiteMovePly);
                        const blackComments = blackMovePly ? getCommentsForMove(blackMovePly) : [];

                        return (
                          <div key={pairIndex} className="space-y-1">
                            <div className="flex items-start gap-2">
                              {/* Move number */}
                              <div className="text-[#6b6460] light:text-[#a0958a] font-semibold min-w-[2.5rem] text-right pt-1 text-sm">
                                {pair.moveNumber}.
                              </div>

                              {/* White's move */}
                              <div className="flex-1">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => goToMove(pair.white.index)}
                                    className={`flex-1 px-2 py-1 rounded text-left transition-colors text-sm font-mono ${
                                      currentMoveIndex === pair.white.index
                                        ? 'bg-orange-500 text-white font-semibold'
                                        : 'text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8]'
                                    }`}
                                  >
                                    {pair.white.san}
                                    {getGlyphForMove(whiteMovePly) && (
                                      <span className="ml-1 text-orange-400 font-bold">{getGlyphForMove(whiteMovePly)}</span>
                                    )}
                                  </button>
                                  {session && study.isOwner && (
                                    <div className="flex items-center gap-0.5">
                                      <div className="relative">
                                        <button
                                          onClick={() => {
                                            setEditingGlyph(editingGlyph === whiteMovePly ? null : whiteMovePly);
                                          }}
                                          className="p-1 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                                          title="Add glyph"
                                        >
                                          <Sparkles className={`w-3 h-3 ${getGlyphForMove(whiteMovePly) ? 'text-orange-400' : 'text-[#a0958a] light:text-[#6b6560]'}`} />
                                        </button>
                                        {editingGlyph === whiteMovePly && (
                                          <div className="glyph-dropdown absolute left-0 top-full mt-1 z-50 bg-[#2a2720] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg shadow-xl p-2">
                                            <div className="grid grid-cols-3 gap-1">
                                              {glyphOptions.map((glyph) => (
                                                <button
                                                  key={glyph.symbol}
                                                  onClick={() => handleSetGlyph(whiteMovePly, glyph.symbol)}
                                                  className={`px-2 py-1 rounded text-sm font-bold transition-colors ${
                                                    getGlyphForMove(whiteMovePly) === glyph.symbol
                                                      ? 'bg-orange-400 text-black'
                                                      : 'bg-[#33302c] light:bg-[#f0ebe0] text-white light:text-black hover:bg-[#3a3632] light:hover:bg-[#e8e3d8]'
                                                  }`}
                                                  title={glyph.label}
                                                >
                                                  {glyph.symbol}
                  </button>
                ))}
              </div>
                                            <button
                                              onClick={() => {
                                                const newGlyphs = new Map(moveGlyphs);
                                                newGlyphs.delete(whiteMovePly);
                                                setMoveGlyphs(newGlyphs);
                                                setEditingGlyph(null);
                                              }}
                                              className="mt-1 w-full px-2 py-1 text-xs bg-[#33302c] light:bg-[#f0ebe0] hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded transition-colors"
                                            >
                                              Remove
                                            </button>
            </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => {
                                          setCommentingOnMove(commentingOnMove === whiteMovePly ? null : whiteMovePly);
                                          setMoveCommentText('');
                                        }}
                                        className="p-1 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                                        title="Add comment"
                                      >
                                        <MessageSquare className="w-3 h-3 text-[#a0958a] light:text-[#6b6560]" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {/* White move comments */}
                                {(whiteComments.length > 0 || commentingOnMove === whiteMovePly) && (
                                  <div className="ml-0 mt-1 space-y-1">
                                    {whiteComments.map((comment) => (
                                      <div key={comment.id} className="p-1.5 bg-[#2a2720] light:bg-[#f0ebe0] rounded border border-[#474239] light:border-[#d4caba]">
                                        {editingComment === comment.id ? (
                                          <>
                                            <input
                                              type="text"
                                              value={editCommentText}
                                              onChange={(e) => setEditCommentText(e.target.value)}
                                              className="w-full px-2 py-1 mb-1.5 bg-[#33302c] light:bg-white border border-[#474239] light:border-[#d4caba] rounded text-white light:text-black focus:outline-none focus:ring-1 focus:ring-orange-400 text-xs"
                                              onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                  handleSaveEditComment(comment.id);
                                                } else if (e.key === 'Escape') {
                                                  setEditingComment(null);
                                                  setEditCommentText('');
                                                }
                                              }}
                                              autoFocus
                                            />
                                            <div className="flex gap-1.5">
                                              <button
                                                onClick={() => handleSaveEditComment(comment.id)}
                                                className="flex-1 px-2 py-0.5 bg-orange-400 hover:bg-orange-500 text-black rounded text-xs font-medium transition-colors"
                                              >
                                                Save
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setEditingComment(null);
                                                  setEditCommentText('');
                                                }}
                                                className="px-2 py-0.5 bg-[#33302c] light:bg-white hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded text-xs transition-colors"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="flex items-center justify-between mb-0.5">
                                              <div className="flex items-center gap-1.5">
                                                {comment.user.image && (
                                                  <img src={comment.user.image} alt={comment.user.handle} className="w-3 h-3 rounded-full" />
                                                )}
                                                <span className="text-xs font-medium text-white light:text-black">{comment.user.handle}</span>
                                              </div>
                                              {canEditComment(comment) && (
                                                <div className="flex items-center gap-1">
                                                  <button
                                                    onClick={() => handleEditComment(comment.id, comment.text)}
                                                    className="p-0.5 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                                                    title="Edit comment"
                                                  >
                                                    <Pencil className="w-2.5 h-2.5 text-[#a0958a] light:text-[#6b6560]" />
                                                  </button>
                                                  <button
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                    className="p-0.5 rounded hover:bg-red-500/20 transition-colors"
                                                    title="Delete comment"
                                                  >
                                                    <Trash2 className="w-2.5 h-2.5 text-red-400" />
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                            <p className="text-xs text-[#c1b9ad] light:text-[#4a453e]">{comment.text}</p>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                    {commentingOnMove === whiteMovePly && (
                                      <div className="p-1.5 bg-[#2a2720] light:bg-[#f0ebe0] rounded border border-[#474239] light:border-[#d4caba]">
                                        <input
                                          type="text"
                                          value={moveCommentText}
                                          onChange={(e) => setMoveCommentText(e.target.value)}
                                          placeholder="Comment..."
                                          className="w-full px-2 py-1 mb-1.5 bg-[#33302c] light:bg-white border border-[#474239] light:border-[#d4caba] rounded text-white light:text-black focus:outline-none focus:ring-1 focus:ring-orange-400 text-xs"
                                          onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                              handleAddMoveComment(whiteMovePly);
                                            } else if (e.key === 'Escape') {
                                              setCommentingOnMove(null);
                                              setMoveCommentText('');
                                            }
                                          }}
                                          autoFocus
                                        />
                                        <div className="flex gap-1.5">
                                          <button
                                            onClick={() => handleAddMoveComment(whiteMovePly)}
                                            className="flex-1 px-2 py-0.5 bg-orange-400 hover:bg-orange-500 text-black rounded text-xs font-medium transition-colors"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={() => {
                                              setCommentingOnMove(null);
                                              setMoveCommentText('');
                                            }}
                                            className="px-2 py-0.5 bg-[#33302c] light:bg-white hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded text-xs transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Black's move */}
                              {pair.black ? (
                                <div className="flex-1">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => goToMove(pair.black!.index)}
                                      className={`flex-1 px-2 py-1 rounded text-left transition-colors text-sm font-mono ${
                                        currentMoveIndex === pair.black!.index
                                          ? 'bg-orange-500 text-white font-semibold'
                                          : 'text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8]'
                                      }`}
                                    >
                                      {pair.black.san}
                                      {getGlyphForMove(blackMovePly!) && (
                                        <span className="ml-1 text-orange-400 font-bold">{getGlyphForMove(blackMovePly!)}</span>
                                      )}
                                    </button>
                                    {session && study.isOwner && (
                                      <div className="flex items-center gap-0.5">
                                        <div className="relative">
                                          <button
                                            onClick={() => {
                                              setEditingGlyph(editingGlyph === blackMovePly ? null : blackMovePly!);
                                            }}
                                            className="p-1 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                                            title="Add glyph"
                                          >
                                            <Sparkles className={`w-3 h-3 ${getGlyphForMove(blackMovePly!) ? 'text-orange-400' : 'text-[#a0958a] light:text-[#6b6560]'}`} />
                                          </button>
                                          {editingGlyph === blackMovePly && (
                                            <div className="glyph-dropdown absolute right-0 top-full mt-1 z-50 bg-[#2a2720] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg shadow-xl p-2">
                                              <div className="grid grid-cols-3 gap-1">
                                                {glyphOptions.map((glyph) => (
                                                  <button
                                                    key={glyph.symbol}
                                                    onClick={() => handleSetGlyph(blackMovePly!, glyph.symbol)}
                                                    className={`px-2 py-1 rounded text-sm font-bold transition-colors ${
                                                      getGlyphForMove(blackMovePly!) === glyph.symbol
                                                        ? 'bg-orange-400 text-black'
                                                        : 'bg-[#33302c] light:bg-[#f0ebe0] text-white light:text-black hover:bg-[#3a3632] light:hover:bg-[#e8e3d8]'
                                                    }`}
                                                    title={glyph.label}
                                                  >
                                                    {glyph.symbol}
                                                  </button>
                                                ))}
                                              </div>
                                              <button
                                                onClick={() => {
                                                  const newGlyphs = new Map(moveGlyphs);
                                                  newGlyphs.delete(blackMovePly!);
                                                  setMoveGlyphs(newGlyphs);
                                                  setEditingGlyph(null);
                                                }}
                                                className="mt-1 w-full px-2 py-1 text-xs bg-[#33302c] light:bg-[#f0ebe0] hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded transition-colors"
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                        {session && study.isOwner && (
                                          <button
                                            onClick={() => handleStartVariation(blackMovePly!)}
                                            className="p-1 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                                            title="Add variation"
                                          >
                                            <GitBranch className={`w-3 h-3 ${getVariationsForMove(blackMovePly!) ? 'text-orange-400' : 'text-[#a0958a] light:text-[#6b6560]'}`} />
                                          </button>
                                        )}
                                        <button
                                          onClick={() => {
                                            setCommentingOnMove(commentingOnMove === blackMovePly ? null : blackMovePly!);
                                            setMoveCommentText('');
                                          }}
                                          className="p-1 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                                          title="Add comment"
                                        >
                                          <MessageSquare className="w-3 h-3 text-[#a0958a] light:text-[#6b6560]" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  {/* Black move variations */}
                                  {getVariationsForMove(blackMovePly!) && (
                                    <div className="ml-0 mt-1 mb-1">
                                      <div className="p-1.5 bg-[#2a2720] light:bg-[#f0ebe0] rounded border border-orange-500/30 light:border-orange-300 rounded-lg">
                                        <div className="flex items-center gap-1 mb-1">
                                          <GitBranch className="w-3 h-3 text-orange-400" />
                                          <span className="text-xs font-medium text-white light:text-black">Variation</span>
                                        </div>
                                        <div className="text-xs text-[#c1b9ad] light:text-[#4a453e] font-mono">
                                          {(() => {
                                            const chess = new Chess(selectedChapter.initialFen);
                                            const movesBeforeVariation = moveHistory.slice(0, blackMovePly! - 1);
                                            for (const uci of movesBeforeVariation) {
                                              chess.move({
                                                from: uci.slice(0, 2),
                                                to: uci.slice(2, 4),
                                                promotion: uci.length > 4 ? uci[4] : undefined,
                                              });
                                            }
                                            const variationMoves = getVariationsForMove(blackMovePly!)!;
                                            const sanMoves: string[] = [];
                                            for (const uci of variationMoves) {
                                              try {
                                                const move = chess.move({
                                                  from: uci.slice(0, 2),
                                                  to: uci.slice(2, 4),
                                                  promotion: uci.length > 4 ? uci[4] : undefined,
                                                });
                                                if (move) sanMoves.push(move.san);
                                              } catch (e) {
                                                // Skip invalid moves
                                              }
                                            }
                                            return sanMoves.join(' ');
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {/* Black move comments */}
                                  {(blackComments.length > 0 || commentingOnMove === blackMovePly) && (
                                    <div className="ml-0 mt-1 space-y-1">
                                      {blackComments.map((comment) => (
                                        <div key={comment.id} className="p-1.5 bg-[#2a2720] light:bg-[#f0ebe0] rounded border border-[#474239] light:border-[#d4caba]">
                                          {editingComment === comment.id ? (
                                            <>
                                              <input
                                                type="text"
                                                value={editCommentText}
                                                onChange={(e) => setEditCommentText(e.target.value)}
                                                className="w-full px-2 py-1 mb-1.5 bg-[#33302c] light:bg-white border border-[#474239] light:border-[#d4caba] rounded text-white light:text-black focus:outline-none focus:ring-1 focus:ring-orange-400 text-xs"
                                                onKeyPress={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleSaveEditComment(comment.id);
                                                  } else if (e.key === 'Escape') {
                                                    setEditingComment(null);
                                                    setEditCommentText('');
                                                  }
                                                }}
                                                autoFocus
                                              />
                                              <div className="flex gap-1.5">
                                                <button
                                                  onClick={() => handleSaveEditComment(comment.id)}
                                                  className="flex-1 px-2 py-0.5 bg-orange-400 hover:bg-orange-500 text-black rounded text-xs font-medium transition-colors"
                                                >
                                                  Save
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    setEditingComment(null);
                                                    setEditCommentText('');
                                                  }}
                                                  className="px-2 py-0.5 bg-[#33302c] light:bg-white hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded text-xs transition-colors"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </>
                                          ) : (
                                            <>
                                              <div className="flex items-center justify-between mb-0.5">
                                                <div className="flex items-center gap-1.5">
                                                  {comment.user.image && (
                                                    <img src={comment.user.image} alt={comment.user.handle} className="w-3 h-3 rounded-full" />
                                                  )}
                                                  <span className="text-xs font-medium text-white light:text-black">{comment.user.handle}</span>
                                                </div>
                                                {canEditComment(comment) && (
                                                  <div className="flex items-center gap-1">
                                                    <button
                                                      onClick={() => handleEditComment(comment.id, comment.text)}
                                                      className="p-0.5 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                                                      title="Edit comment"
                                                    >
                                                      <Pencil className="w-2.5 h-2.5 text-[#a0958a] light:text-[#6b6560]" />
                                                    </button>
                                                    <button
                                                      onClick={() => handleDeleteComment(comment.id)}
                                                      className="p-0.5 rounded hover:bg-red-500/20 transition-colors"
                                                      title="Delete comment"
                                                    >
                                                      <Trash2 className="w-2.5 h-2.5 text-red-400" />
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                              <p className="text-xs text-[#c1b9ad] light:text-[#4a453e]">{comment.text}</p>
                                            </>
                                          )}
                                        </div>
                                      ))}
                                      {commentingOnMove === blackMovePly && (
                                        <div className="p-1.5 bg-[#2a2720] light:bg-[#f0ebe0] rounded border border-[#474239] light:border-[#d4caba]">
                                          <input
                                            type="text"
                                            value={moveCommentText}
                                            onChange={(e) => setMoveCommentText(e.target.value)}
                                            placeholder="Comment..."
                                            className="w-full px-2 py-1 mb-1.5 bg-[#33302c] light:bg-white border border-[#474239] light:border-[#d4caba] rounded text-white light:text-black focus:outline-none focus:ring-1 focus:ring-orange-400 text-xs"
                                            onKeyPress={(e) => {
                                              if (e.key === 'Enter') {
                                                handleAddMoveComment(blackMovePly!);
                                              } else if (e.key === 'Escape') {
                                                setCommentingOnMove(null);
                                                setMoveCommentText('');
                                              }
                                            }}
                                            autoFocus
                                          />
                                          <div className="flex gap-1.5">
                                            <button
                                              onClick={() => handleAddMoveComment(blackMovePly!)}
                                              className="flex-1 px-2 py-0.5 bg-orange-400 hover:bg-orange-500 text-black rounded text-xs font-medium transition-colors"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={() => {
                                                setCommentingOnMove(null);
                                                setMoveCommentText('');
                                              }}
                                              className="px-2 py-0.5 bg-[#33302c] light:bg-white hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded text-xs transition-colors"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex-1" />
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center: Board */}
          <div className="lg:col-span-6 order-2 lg:order-2">
            <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4">
              {selectedChapter ? (
                currentFen ? (
                  <>
                    <div className="flex justify-center mb-4 sm:mb-6">
                      <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-2 sm:p-4">
                <Chess960Board
                  fen={currentFen}
                  orientation="white"
                          width={boardWidth}
                          onMove={creatingVariation ? handleAddVariationMove : handleMove}
                  showCoordinates={true}
                          readOnly={!study.isOwner || creatingVariation !== null}
                          lastMove={
                            currentMoveIndex > 0 && currentMoveIndex <= moveHistory.length
                              ? (() => {
                                  const move = moveHistory[currentMoveIndex - 1];
                                  return [
                                    move.slice(0, 2),
                                    move.slice(2, 4),
                                  ] as [string, string];
                                })()
                              : null
                          }
                          arrows={boardArrows}
                          onArrowsChange={setBoardArrows}
                          eraseArrowsOnClick={true}
                        />
                      </div>
                    </div>
                  
                  {/* Board Tools */}
                  {study.isOwner && (
                    <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
                      <div className="text-xs text-[#a0958a] light:text-[#6b6560] px-2">
                        Right-click squares to highlight (circles)
                      </div>
                      {boardArrows.length > 0 && (
                        <button
                          onClick={() => setBoardArrows([])}
                          className="px-3 py-1.5 bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] text-white light:text-black hover:bg-[#35322e] light:hover:bg-[#e8e3d8] rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                          title="Clear all arrows"
                        >
                          <X className="w-3 h-3" />
                          Clear Arrows ({boardArrows.length})
                        </button>
                      )}
                    </div>
                  )}

                  {/* Navigation Controls */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4">
                    <button
                      onClick={goToFirst}
                      disabled={currentMoveIndex === 0}
                      className="p-1.5 sm:p-2 rounded-lg bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="First move (Home)"
                    >
                      <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={goToPrevious}
                      disabled={currentMoveIndex === 0}
                      className="p-1.5 sm:p-2 rounded-lg bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Previous move (←)"
                    >
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <span className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-[#a0958a] light:text-[#6b6560] font-medium">
                      {currentMoveIndex === 0 ? 'Start' : `${currentMoveIndex}/${moveHistory.length}`}
                    </span>
                    <button
                      onClick={goToNext}
                      disabled={currentMoveIndex >= moveHistory.length}
                      className="p-1.5 sm:p-2 rounded-lg bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Next move (→)"
                    >
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={goToLast}
                      disabled={currentMoveIndex >= moveHistory.length}
                      className="p-1.5 sm:p-2 rounded-lg bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Last move (End)"
                    >
                      <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                  
                    {/* Variation Creation UI */}
                    {creatingVariation !== null && (
                      <div className="mt-4 p-3 bg-orange-500/20 light:bg-orange-100 border border-orange-500/50 light:border-orange-300 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-white light:text-black flex items-center gap-2">
                            <GitBranch className="w-4 h-4" />
                            Creating Variation
                          </h3>
                        </div>
                        <p className="text-xs text-[#c1b9ad] light:text-[#4a453e] mb-2">
                          Add moves to create a variation. Click on the board to add moves.
                        </p>
                        {variationMoves.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-[#a0958a] light:text-[#6b6560] mb-1">Variation moves:</p>
                            <div className="text-xs text-[#c1b9ad] light:text-[#4a453e] font-mono">
                              {variationMoves.map((uci, idx) => {
                                const chess = new Chess(selectedChapter.initialFen);
                                const movesBeforeVariation = moveHistory.slice(0, creatingVariation - 1);
                                for (const m of movesBeforeVariation) {
                                  chess.move({
                                    from: m.slice(0, 2),
                                    to: m.slice(2, 4),
                                    promotion: m.length > 4 ? m[4] : undefined,
                                  });
                                }
                                for (let i = 0; i < idx; i++) {
                                  chess.move({
                                    from: variationMoves[i].slice(0, 2),
                                    to: variationMoves[i].slice(2, 4),
                                    promotion: variationMoves[i].length > 4 ? variationMoves[i][4] : undefined,
                                  });
                                }
                                try {
                                  const move = chess.move({
                                    from: uci.slice(0, 2),
                                    to: uci.slice(2, 4),
                                    promotion: uci.length > 4 ? uci[4] : undefined,
                                  });
                                  return move ? move.san : uci;
                                } catch {
                                  return uci;
                                }
                              }).join(' ')}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveVariation}
                            disabled={variationMoves.length === 0}
                            className="flex-1 px-3 py-1.5 bg-orange-400 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg transition-colors text-sm font-medium"
                          >
                            Save Variation
                          </button>
                          <button
                            onClick={handleCancelVariation}
                            className="px-3 py-1.5 bg-[#33302c] light:bg-white hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded-lg transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PGN Display & Actions */}
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white light:text-black">PGN</h3>
                        <div className="flex items-center gap-2">
                          {study.isOwner && (
                            <>
                              <button
                                onClick={() => setShowImportPGN(!showImportPGN)}
                                className="px-3 py-1.5 bg-[#2a2720] light:bg-[#f0ebe0] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5"
                                title="Import PGN"
                              >
                                <Upload className="w-3 h-3" />
                                Import
                              </button>
                              <button
                                onClick={handleExportPGN}
                                className="px-3 py-1.5 bg-[#2a2720] light:bg-[#f0ebe0] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5"
                                title="Export PGN"
                              >
                                <Download className="w-3 h-3" />
                                Export
                              </button>
                            </>
                          )}
                          {saving && (
                            <span className="text-xs text-[#a0958a] light:text-[#6b6560] animate-pulse">Saving...</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Import PGN UI */}
                      {showImportPGN && study.isOwner && (
                        <div className="p-3 bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-white light:text-black">Import PGN</h4>
                            <button
                              onClick={() => {
                                setShowImportPGN(false);
                                setImportPGNText('');
                              }}
                              className="p-1 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                            >
                              <X className="w-3 h-3 text-[#a0958a] light:text-[#6b6560]" />
                            </button>
                          </div>
                          <textarea
                            value={importPGNText}
                            onChange={(e) => setImportPGNText(e.target.value)}
                            placeholder="Paste PGN here..."
                            className="w-full px-3 py-2 mb-2 bg-[#33302c] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:ring-2 focus:ring-orange-400 text-xs font-mono min-h-24"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleImportPGN}
                              disabled={!importPGNText.trim()}
                              className="flex-1 px-3 py-1.5 bg-orange-400 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg transition-colors text-xs font-medium"
                            >
                              Import
                            </button>
                            <label className="px-3 py-1.5 bg-[#33302c] light:bg-white hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded-lg transition-colors text-xs font-medium cursor-pointer flex items-center gap-1.5">
                              <Upload className="w-3 h-3" />
                              From File
                              <input
                                type="file"
                                accept=".pgn,.txt"
                                onChange={handleImportPGNFile}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                      
                      {/* PGN Display */}
                      {selectedChapter.pgn && (
                        <div className="p-3 bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] rounded-lg">
                          <pre className="text-xs text-[#c1b9ad] light:text-[#4a453e] font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                            {formatPgnWithGlyphs(selectedChapter.pgn)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <p className="text-[#a0958a] light:text-[#6b6560]">Loading chapter...</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <p className="text-[#a0958a] light:text-[#6b6560] mb-4">No chapter selected</p>
                    {study.chapters.length === 0 && study.isOwner && (
                      <p className="text-sm text-[#6b6460] light:text-[#a0958a]">Add a chapter to get started</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Comments */}
          <div className="lg:col-span-3 order-3 lg:order-3">
            <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4">
              <h2 className="text-xl font-semibold text-white light:text-black mb-4">Comments</h2>
              <div className="space-y-4 mb-4 max-h-64 sm:max-h-96 overflow-y-auto">
                {study.comments.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 text-[#6b6460] light:text-[#a0958a] mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-[#a0958a] light:text-[#6b6560]">No comments yet</p>
                  </div>
                ) : (
                  study.comments
                    .filter(c => !c.movePly) // Only show general comments (not move-specific)
                    .map((comment) => (
                      <div key={comment.id} className="border-b border-[#474239] light:border-[#d4caba] pb-3 last:border-b-0">
                        {editingComment === comment.id ? (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              {comment.user.image && (
                                <img src={comment.user.image} alt={comment.user.handle} className="w-6 h-6 rounded-full" />
                              )}
                              <span className="text-sm font-medium text-white light:text-black">{comment.user.handle}</span>
                            </div>
                            <input
                              type="text"
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              className="w-full px-3 py-2 mb-2 bg-[#33302c] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveEditComment(comment.id);
                                } else if (e.key === 'Escape') {
                                  setEditingComment(null);
                                  setEditCommentText('');
                                }
                              }}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEditComment(comment.id)}
                                className="px-3 py-1.5 bg-orange-400 hover:bg-orange-500 text-black rounded-lg transition-colors text-sm font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingComment(null);
                                  setEditCommentText('');
                                }}
                                className="px-3 py-1.5 bg-[#33302c] light:bg-white hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded-lg transition-colors text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                      {comment.user.image && (
                        <img src={comment.user.image} alt={comment.user.handle} className="w-6 h-6 rounded-full" />
                      )}
                      <span className="text-sm font-medium text-white light:text-black">{comment.user.handle}</span>
                      {comment.movePly && (
                        <span className="text-xs text-[#a0958a] light:text-[#6b6560]">Move {comment.movePly}</span>
                                )}
                              </div>
                              {canEditComment(comment) && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEditComment(comment.id, comment.text)}
                                    className="p-1 rounded hover:bg-[#3a3632] light:hover:bg-[#e8e3d8] transition-colors"
                                    title="Edit comment"
                                  >
                                    <Pencil className="w-4 h-4 text-[#a0958a] light:text-[#6b6560]" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="p-1 rounded hover:bg-red-500/20 transition-colors"
                                    title="Delete comment"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                  </button>
                                </div>
                      )}
                    </div>
                    <p className="text-sm text-[#c1b9ad] light:text-[#4a453e]">{comment.text}</p>
                          </>
                        )}
                  </div>
                    ))
                )}
              </div>
              {session && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 bg-[#33302c] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <button
                    onClick={handleAddComment}
                    className="px-4 py-2 bg-orange-400 hover:bg-orange-500 text-black rounded-lg transition-colors"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

