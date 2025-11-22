'use client';

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserHandle: string;
  gameId?: string;
  messageId?: string;
}

const REPORT_REASONS = [
  { value: 'CHEATING', label: 'Cheating', description: 'Using engines or assistance during games' },
  { value: 'TOXIC_BEHAVIOR', label: 'Toxic Behavior', description: 'Abusive or unsportsmanlike conduct' },
  { value: 'SPAM', label: 'Spam', description: 'Repeated unwanted messages or content' },
  { value: 'HARASSMENT', label: 'Harassment', description: 'Targeted harassment or bullying' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate Content', description: 'Offensive or inappropriate messages' },
  { value: 'OTHER', label: 'Other', description: 'Other violations of community guidelines' },
] as const;

export function ReportModal({
  isOpen,
  onClose,
  reportedUserId,
  reportedUserHandle,
  gameId,
  messageId,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedReason) {
      setError('Please select a reason for reporting');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedId: reportedUserId,
          reason: selectedReason,
          description: description.trim() || undefined,
          gameId: gameId || undefined,
          messageId: messageId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to submit report');
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setSelectedReason('');
        setDescription('');
      }, 2000);
    } catch (error) {
      console.error('Error submitting report:', error);
      setError('An error occurred while submitting the report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !success) {
      onClose();
      setSelectedReason('');
      setDescription('');
      setError('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#2a2825] light:bg-white border-2 border-[#474239] light:border-[#d4caba] rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#474239] light:border-[#d4caba]">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
            <h2 className="text-lg sm:text-xl font-bold text-white light:text-black">
              Report User
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting || success}
            className="text-gray-400 hover:text-white light:hover:text-black transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-white light:text-black mb-2">
                Report Submitted
              </h3>
              <p className="text-sm text-gray-400 light:text-gray-600">
                Thank you for your report. We will review it shortly.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 sm:mb-6">
                <p className="text-sm text-gray-300 light:text-gray-700 mb-2">
                  Reporting: <span className="font-semibold text-white light:text-black">{reportedUserHandle}</span>
                </p>
                <p className="text-xs text-gray-400 light:text-gray-600">
                  Please select a reason and provide details about the violation.
                </p>
              </div>

              {/* Reason Selection */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-medium text-white light:text-black mb-2">
                  Reason for Report *
                </label>
                <div className="space-y-2">
                  {REPORT_REASONS.map((reason) => (
                    <label
                      key={reason.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedReason === reason.value
                          ? 'border-orange-400 bg-orange-400/10'
                          : 'border-[#474239] light:border-[#d4caba] bg-[#35322e] light:bg-gray-50 hover:border-orange-400/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={reason.value}
                        checked={selectedReason === reason.value}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white light:text-black text-sm">
                          {reason.label}
                        </div>
                        <div className="text-xs text-gray-400 light:text-gray-600 mt-0.5">
                          {reason.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-medium text-white light:text-black mb-2">
                  Additional Details (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide any additional context or details about the violation..."
                  rows={4}
                  maxLength={1000}
                  className="w-full px-3 py-2 bg-[#35322e] light:bg-gray-100 border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-gray-500 light:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none text-sm"
                />
                <div className="text-xs text-gray-400 light:text-gray-600 mt-1 text-right">
                  {description.length}/1000
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedReason}
                  className="flex-1 px-4 py-2 bg-orange-400 hover:bg-orange-500 text-black rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}



