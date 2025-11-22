'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { BookOpen, Plus, Search, Heart, Eye, MessageSquare, Filter, Tag } from 'lucide-react';

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
  createdAt: string;
  updatedAt: string;
  likes: number;
  views: number;
  chapterCount: number;
  commentCount: number;
  likeCount: number;
  isLiked: boolean;
  isOwner: boolean;
}

export default function StudyPage() {
  const { data: session } = useSession();
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'public' | 'my'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStudies();
  }, [filter, session]);

  const fetchStudies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter === 'public') {
        params.append('public', 'true');
      } else if (filter === 'my') {
        params.append('my', 'true');
      }
      const response = await fetch(`/api/study?${params.toString()}`);
      const data = await response.json();
      setStudies(data.studies || []);
    } catch (error) {
      console.error('Error fetching studies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudies = studies.filter(study => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      study.title.toLowerCase().includes(query) ||
      study.description?.toLowerCase().includes(query) ||
      study.owner.handle.toLowerCase().includes(query) ||
      study.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-orange-400" />
            Study Mode
          </h1>
          <div className="text-[#b6aea2] light:text-[#5a5449] max-w-2xl mx-auto space-y-2 px-4">
            <p className="text-sm sm:text-base">
              Create and explore annotated chess studies with move-by-move analysis
            </p>
          </div>
        </div>

        {/* Create Study Button - Always visible, but redirects to sign in if not logged in */}
        <div className="mb-6 sm:mb-8 text-center px-4">
          <Link
            href={session ? "/study/create" : "/auth/signin"}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl text-base sm:text-lg"
          >
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
            {session ? "Create New Study" : "Sign In to Create Study"}
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-center gap-2 mb-8 flex-wrap px-4 overflow-x-auto scrollbar-hide">
          {['all', 'public', ...(session ? ['my'] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab as any)}
              className={`px-3 sm:px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 text-sm sm:text-base whitespace-nowrap ${
                filter === tab
                  ? 'bg-gradient-to-r from-orange-300 to-orange-400 text-white shadow-lg'
                  : 'bg-[#35322e] light:bg-white text-[#a0958a] light:text-[#5a5449] hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba]'
              }`}
            >
              {tab === 'all' ? 'All Studies' : tab === 'public' ? 'Public' : 'My Studies'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6 max-w-md mx-auto px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[#a0958a] light:text-[#6b6560]" />
            <input
              type="text"
              placeholder="Search studies, tags, authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:border-orange-300 transition-colors text-sm sm:text-base"
            />
          </div>
        </div>

        {/* Studies List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-[#a0958a] light:text-[#5a5449]">Loading studies...</p>
          </div>
        ) : filteredStudies.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-[#a0958a] light:text-[#6b6560] mx-auto mb-4" />
            <p className="text-[#a0958a] light:text-[#6b6560] text-lg">
              {searchQuery ? 'No studies found matching your search' : 'No studies yet'}
            </p>
            {session && !searchQuery && (
              <Link
                href="/study/create"
                className="inline-block mt-4 bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Create First Study
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-4 sm:px-0">
            {filteredStudies.map((study) => (
              <Link
                key={study.id}
                href={`/study/${study.id}`}
                className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4 sm:p-6 hover:border-orange-300/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]"
              >
                <h3 className="text-lg sm:text-xl font-semibold text-white light:text-black mb-2 line-clamp-2">
                  {study.title}
                </h3>
                {study.description && (
                  <p className="text-[#a0958a] light:text-[#6b6560] text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">
                    {study.description}
                  </p>
                )}
                {/* Tags */}
                {study.tags && study.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3 sm:mb-4">
                    {study.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] rounded-lg text-xs text-white light:text-black"
                      >
                        <Tag className="w-2.5 h-2.5 text-orange-400" />
                        {tag}
                      </span>
                    ))}
                    {study.tags.length > 3 && (
                      <span className="text-xs text-[#a0958a] light:text-[#6b6560]">
                        +{study.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-[#a0958a] light:text-[#6b6560] mb-3 sm:mb-4">
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                    {study.views}
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className={`w-3 h-3 sm:w-4 sm:h-4 ${study.isLiked ? 'text-[#f97316] fill-[#f97316]' : ''}`} />
                    {study.likeCount}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                    {study.commentCount}
                  </div>
                  <div className="text-xs">
                    {study.chapterCount} {study.chapterCount === 1 ? 'chapter' : 'chapters'}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {study.owner.image && (
                      <img
                        src={study.owner.image}
                        alt={study.owner.handle}
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full"
                      />
                    )}
                    <span className="text-xs sm:text-sm text-[#c1b9ad] light:text-[#4a453e]">
                      {study.owner.handle}
                    </span>
                  </div>
                  {!study.isPublic && (
                    <span className="text-xs px-2 py-1 bg-[#33302c] light:bg-[#f0ebe0] rounded">
                      Private
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

