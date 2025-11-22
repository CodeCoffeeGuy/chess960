'use client';

import { Construction } from 'lucide-react';
import Link from 'next/link';

export default function PuzzleThemesPage() {
  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#1a1814] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-[#2a2720] rounded-lg shadow-lg p-12 text-center">
          <Construction className="w-24 h-24 mx-auto mb-6 text-[#8b7355] dark:text-[#a0958a]" />
          <h1 className="text-3xl font-bold mb-4 text-[#2c1810] dark:text-[#e8e6e3]">
            Puzzle Themes
          </h1>
          <p className="text-xl text-[#5a5449] dark:text-[#a0958a] mb-8">
            Coming Soon
          </p>
          <p className="text-[#8b7355] dark:text-[#6b6459] mb-6">
            Browse puzzles by theme - tactics, endgames, checkmates, and more. Coming soon!
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-[#8b7355] hover:bg-[#7a6345] text-white rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
