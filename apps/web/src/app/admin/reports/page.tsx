'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Flag, Check, X, Clock, AlertCircle, Filter, Search } from 'lucide-react';
import Link from 'next/link';

interface Report {
  id: string;
  reporter: {
    id: string;
    handle: string;
    fullName?: string | null;
  };
  reported: {
    id: string;
    handle: string;
    fullName?: string | null;
  };
  reason: string;
  status: string;
  description?: string | null;
  gameId?: string | null;
  messageId?: string | null;
  resolution?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const REPORT_REASONS: Record<string, { label: string; color: string }> = {
  CHEATING: { label: 'Cheating', color: 'text-red-400' },
  TOXIC_BEHAVIOR: { label: 'Toxic Behavior', color: 'text-orange-400' },
  SPAM: { label: 'Spam', color: 'text-yellow-400' },
  HARASSMENT: { label: 'Harassment', color: 'text-red-500' },
  INAPPROPRIATE_CONTENT: { label: 'Inappropriate Content', color: 'text-pink-400' },
  OTHER: { label: 'Other', color: 'text-gray-400' },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  REVIEWING: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  RESOLVED: 'bg-green-500/20 text-green-400 border-green-500/50',
  DISMISSED: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  ESCALATED: 'bg-red-500/20 text-red-400 border-red-500/50',
};

export default function AdminReportsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('PENDING');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (session?.user) {
      checkAdminAccess();
    }
  }, [session]);

  useEffect(() => {
    if (isAdmin === true) {
      fetchReports();
    }
  }, [isAdmin, selectedStatus]);

  const checkAdminAccess = async () => {
    try {
      const response = await fetch('/api/admin/check');
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.isAdmin);
        if (!data.isAdmin) {
          setError('Access denied. Admin privileges required.');
        }
      } else {
        setIsAdmin(false);
        setError('Failed to verify admin access');
      }
    } catch {
      setIsAdmin(false);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/report?status=${selectedStatus}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      } else {
        const errorData = await response.json();
        setError(`Failed to fetch reports: ${errorData.error}`);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reportId: string, newStatus: string) => {
    setActionLoading(reportId);
    try {
      const response = await fetch(`/api/report/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolution: resolution || undefined,
        }),
      });

      if (response.ok) {
        await fetchReports();
        setSelectedReport(null);
        setResolution('');
      } else {
        const errorData = await response.json();
        alert(`Failed to update report: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error updating report:', error);
      alert('An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReports = reports.filter((report) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      report.reporter.handle.toLowerCase().includes(term) ||
      report.reported.handle.toLowerCase().includes(term) ||
      report.description?.toLowerCase().includes(term) ||
      report.reason.toLowerCase().includes(term)
    );
  });

  const pendingCount = reports.filter((r) => r.status === 'PENDING').length;
  const reviewingCount = reports.filter((r) => r.status === 'REVIEWING').length;

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#262421] to-[#1a1816] light:from-[#f5f1ea] light:to-[#ebe7dc] flex items-center justify-center p-4">
        <div className="text-white light:text-black text-center">
          <div className="text-xl">Checking access...</div>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#262421] to-[#1a1816] light:from-[#f5f1ea] light:to-[#ebe7dc] flex items-center justify-center p-4">
        <div className="text-white light:text-black text-center">
          <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
          <p>You must be logged in to access this page.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#262421] to-[#1a1816] light:from-[#f5f1ea] light:to-[#ebe7dc] flex items-center justify-center p-4">
        <div className="text-white light:text-black text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-300 light:text-gray-700 mb-4">
            {error || 'You do not have permission to access this page. Admin privileges are required.'}
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-orange-400 hover:bg-orange-500 text-black rounded-lg font-medium transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#262421] to-[#1a1816] light:from-[#f5f1ea] light:to-[#ebe7dc] p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Flag className="w-6 h-6 sm:w-8 sm:h-8 text-orange-400" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white light:text-black">
              Report Management
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 light:text-gray-700">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              <span>Pending: {pendingCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>Reviewing: {reviewingCount}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#2a2825] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-xl p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Status Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-white light:text-black mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-[#35322e] light:bg-gray-100 border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="PENDING">Pending</option>
                <option value="REVIEWING">Reviewing</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
                <option value="ESCALATED">Escalated</option>
                <option value="">All</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-white light:text-black mb-2">
                <Search className="w-4 h-4 inline mr-2" />
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by user, reason, or description..."
                className="w-full px-3 py-2 bg-[#35322e] light:bg-gray-100 border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-gray-500 light:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Reports List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-white light:text-black">Loading reports...</div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-400 light:text-gray-600">No reports found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="bg-[#2a2825] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-xl p-4 sm:p-6 hover:border-orange-400/50 transition-colors"
              >
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Main Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[report.status]}`}
                      >
                        {report.status}
                      </span>
                      <span
                        className={`text-sm font-medium ${REPORT_REASONS[report.reason]?.color || 'text-gray-400'}`}
                      >
                        {REPORT_REASONS[report.reason]?.label || report.reason}
                      </span>
                      <span className="text-xs text-gray-400 light:text-gray-600">
                        {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-400 light:text-gray-600">Reporter: </span>
                        <Link
                          href={`/profile/${report.reporter.handle}`}
                          className="text-orange-400 hover:text-orange-300 font-medium"
                        >
                          {report.reporter.handle}
                        </Link>
                      </div>
                      <div>
                        <span className="text-gray-400 light:text-gray-600">Reported: </span>
                        <Link
                          href={`/profile/${report.reported.handle}`}
                          className="text-orange-400 hover:text-orange-300 font-medium"
                        >
                          {report.reported.handle}
                        </Link>
                      </div>
                      {report.description && (
                        <div>
                          <span className="text-gray-400 light:text-gray-600">Description: </span>
                          <span className="text-white light:text-black">{report.description}</span>
                        </div>
                      )}
                      {report.gameId && (
                        <div>
                          <span className="text-gray-400 light:text-gray-600">Game: </span>
                          <Link
                            href={`/game/${report.gameId}`}
                            className="text-orange-400 hover:text-orange-300"
                          >
                            View Game
                          </Link>
                        </div>
                      )}
                      {report.resolution && (
                        <div>
                          <span className="text-gray-400 light:text-gray-600">Resolution: </span>
                          <span className="text-white light:text-black">{report.resolution}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 lg:w-48">
                    {report.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(report.id, 'REVIEWING')}
                          disabled={actionLoading === report.id}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          <Clock className="w-4 h-4" />
                          {actionLoading === report.id ? 'Processing...' : 'Start Review'}
                        </button>
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                        >
                          View Details
                        </button>
                      </>
                    )}
                    {report.status === 'REVIEWING' && (
                      <>
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors mb-2"
                        >
                          Resolve / Dismiss
                        </button>
                        <button
                          onClick={() => handleStatusChange(report.id, 'ESCALATED')}
                          disabled={actionLoading === report.id}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {actionLoading === report.id ? 'Processing...' : 'Escalate'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Report Detail Modal */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-[#2a2825] light:bg-white border-2 border-[#474239] light:border-[#d4caba] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white light:text-black">Report Details</h2>
                  <button
                    onClick={() => {
                      setSelectedReport(null);
                      setResolution('');
                    }}
                    className="text-gray-400 hover:text-white light:hover:text-black"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <span className="text-gray-400 light:text-gray-600 text-sm">Status: </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[selectedReport.status]}`}
                    >
                      {selectedReport.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 light:text-gray-600 text-sm">Reason: </span>
                    <span className="text-white light:text-black font-medium">
                      {REPORT_REASONS[selectedReport.reason]?.label || selectedReport.reason}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 light:text-gray-600 text-sm">Reporter: </span>
                    <Link
                      href={`/profile/${selectedReport.reporter.handle}`}
                      className="text-orange-400 hover:text-orange-300 font-medium"
                    >
                      {selectedReport.reporter.handle}
                    </Link>
                  </div>
                  <div>
                    <span className="text-gray-400 light:text-gray-600 text-sm">Reported User: </span>
                    <Link
                      href={`/profile/${selectedReport.reported.handle}`}
                      className="text-orange-400 hover:text-orange-300 font-medium"
                    >
                      {selectedReport.reported.handle}
                    </Link>
                  </div>
                  {selectedReport.description && (
                    <div>
                      <span className="text-gray-400 light:text-gray-600 text-sm block mb-1">
                        Description:
                      </span>
                      <p className="text-white light:text-black bg-[#35322e] light:bg-gray-100 p-3 rounded-lg">
                        {selectedReport.description}
                      </p>
                    </div>
                  )}
                  {selectedReport.gameId && (
                    <div>
                      <Link
                        href={`/game/${selectedReport.gameId}`}
                        className="text-orange-400 hover:text-orange-300"
                      >
                        View Related Game →
                      </Link>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400 light:text-gray-600 text-sm">Created: </span>
                    <span className="text-white light:text-black">
                      {new Date(selectedReport.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Resolution Input */}
                {(selectedReport.status === 'REVIEWING' || selectedReport.status === 'PENDING') && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-white light:text-black mb-2">
                      Resolution Notes (Optional)
                    </label>
                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="Add notes about how this report was resolved..."
                      rows={3}
                      className="w-full px-3 py-2 bg-[#35322e] light:bg-gray-100 border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-gray-500 light:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                {selectedReport.status === 'REVIEWING' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleStatusChange(selectedReport.id, 'RESOLVED')}
                      disabled={actionLoading === selectedReport.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {actionLoading === selectedReport.id ? 'Processing...' : 'Resolve'}
                    </button>
                    <button
                      onClick={() => handleStatusChange(selectedReport.id, 'DISMISSED')}
                      disabled={actionLoading === selectedReport.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      {actionLoading === selectedReport.id ? 'Processing...' : 'Dismiss'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

