'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Save, X } from 'lucide-react';

export default function EditStudyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const studyId = params.id as string;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (studyId) {
      fetchStudy();
    }
  }, [studyId]);

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
      
      // Check if user owns the study
      if (!data.study.isOwner) {
        router.push(`/study/${studyId}`);
        return;
      }

      setTitle(data.study.title);
      setDescription(data.study.description || '');
      setIsPublic(data.study.isPublic);
    } catch (error) {
      console.error('Error fetching study:', error);
      router.push('/study');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/study/${studyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          isPublic,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update study');
      }

      router.push(`/study/${studyId}`);
    } catch (error) {
      console.error('Error updating study:', error);
      alert('Failed to update study. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1814] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/study/${studyId}`}
          className="inline-flex items-center gap-2 text-[#a0958a] light:text-[#6b6560] hover:text-white light:hover:text-black mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Study
        </Link>

        <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent mb-6">Edit Study</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white light:text-black font-semibold mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#2a2723] light:bg-[#faf7f2] border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#a0958a] focus:outline-none focus:border-orange-300 transition-colors"
                placeholder="Enter study title..."
              />
            </div>

            <div>
              <label className="block text-white light:text-black font-semibold mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-[#2a2723] light:bg-[#faf7f2] border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#a0958a] focus:outline-none focus:border-orange-300 transition-colors"
                placeholder="Enter study description (optional)..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 text-orange-400 bg-[#2a2723] light:bg-[#faf7f2] border-[#474239] light:border-[#d4caba] rounded focus:ring-orange-400"
              />
              <label htmlFor="isPublic" className="text-sm text-[#c1b9ad] light:text-[#5a5449]">
                Make this study public
              </label>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                href={`/study/${studyId}`}
                className="px-6 py-3 bg-[#2a2723] light:bg-[#faf7f2] hover:bg-[#3a3632] light:hover:bg-[#ebe7dc] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

