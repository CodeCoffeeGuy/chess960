'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';

export default function CreateStudyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!session) {
    return (
      <div className="min-h-screen bg-[#1a1814] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#a0958a] light:text-[#6b6560] text-lg mb-4">Please sign in to create a study</p>
          <Link href="/auth/signin" className="text-[#f97316] hover:text-[#ea580c]">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setLoading(true);
      const response = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          isPublic,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create study');
      }

      const data = await response.json();
      router.push(`/study/${data.study.id}`);
    } catch (error) {
      console.error('Error creating study:', error);
      alert('Failed to create study. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/study"
          className="inline-flex items-center gap-2 text-[#a0958a] light:text-[#6b6560] hover:text-white light:hover:text-black mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Studies
        </Link>

        <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent mb-6">Create New Study</h1>

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
                disabled={loading || !title.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Creating...' : 'Create Study'}
              </button>
              <Link
                href="/study"
                className="px-6 py-3 bg-[#2a2723] light:bg-[#faf7f2] hover:bg-[#3a3632] light:hover:bg-[#ebe7dc] border border-[#474239] light:border-[#d4caba] text-white light:text-black rounded-lg font-semibold transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

