'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Server, Code, Users, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';

function DonationButton({ amount, type = 'one-time' }: { amount: number; type?: 'one-time' | 'subscription' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDonate = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = type === 'subscription'
        ? '/api/stripe/create-subscription'
        : '/api/stripe/create-checkout';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-w-[120px] sm:min-w-[140px]">
      {error && (
        <div className="mb-2 text-xs text-red-400">{error}</div>
      )}
      <button
        onClick={handleDonate}
        disabled={loading}
        className="w-full bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white font-semibold px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
      >
        {loading ? 'Loading...' : type === 'subscription' ? 'Subscribe' : 'Donate'}
      </button>
    </div>
  );
}

function CustomDonation({ type = 'one-time' }: { type?: 'one-time' | 'subscription' }) {
  const [amount, setAmount] = useState('');
  const [showButton, setShowButton] = useState(false);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    const numValue = parseFloat(value);
    setShowButton(numValue >= 1 && numValue <= 10000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-lg sm:text-xl font-bold text-orange-400">$</span>
        <input
          type="number"
          min="1"
          max="10000"
          step="1"
          value={amount}
          onChange={handleAmountChange}
          placeholder="Enter amount"
          className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-[#33302c] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#a0958a] focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent text-sm sm:text-base"
        />
        {type === 'subscription' && (
          <span className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] whitespace-nowrap">/month</span>
        )}
      </div>
      {showButton && (
        <DonationButton amount={parseFloat(amount)} type={type} />
      )}
      {amount && !showButton && (
        <p className="text-xs text-red-400">
          Please enter an amount between $1 and $10,000
        </p>
      )}
    </div>
  );
}

export default function DonatePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openDonationType, setOpenDonationType] = useState<'one-time' | 'monthly' | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const toggleDonationType = (type: 'one-time' | 'monthly') => {
    setOpenDonationType(openDonationType === type ? null : type);
  };

  const faqs = [
    {
      question: "Where does my donation go?",
      answer: "Your donations go directly to covering server costs and supporting development. We run powerful servers to ensure fast, reliable gameplay for everyone. The rest supports the founder who works full-time to improve Chess960."
    },
    {
      question: "Is Chess960 a non-profit?",
      answer: "We operate as a community-funded platform. While we're not yet officially registered as a non-profit, we're committed to keeping Chess960 free and accessible to everyone forever."
    },
    {
      question: "Can I cancel my monthly support?",
      answer: "Yes! You can cancel or modify your monthly support at any time through the Stripe customer portal. Just visit your profile settings and manage your subscriptions."
    },
    {
      question: "Do donors get special features?",
      answer: "No. Chess960 is completely free for everyone, forever. That's our promise. However, supporters will receive a special badge on their profile showing their contribution to the community."
    },
    {
      question: "Is my payment secure?",
      answer: "Absolutely! All payments are processed securely through Stripe, a trusted payment processor used by millions of businesses worldwide. We never see or store your payment details."
    }
  ];

  return (
    <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
      <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16 lg:py-20 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent">
          Support Chess960
        </h1>
        <p className="text-lg sm:text-xl text-[#c1b9ad] light:text-[#5a5449] max-w-2xl mx-auto leading-relaxed px-2">
          Help us keep Chess960 free and accessible for everyone.
          Your support powers our servers and enables continuous development of new features.
        </p>
      </div>

      <AnimatedSection className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Where Your Donation Goes</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          <AnimatedSection delay={100}>
            <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 sm:p-8 hover:border-orange-300/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
              <div className="inline-block p-3 sm:p-4 bg-gradient-to-br from-orange-300 to-orange-400 rounded-lg mb-4 sm:mb-6">
                <Server className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-orange-400">Server Infrastructure</h3>
              <p className="text-sm sm:text-base text-[#c1b9ad] light:text-[#5a5449] leading-relaxed">
                Powerful servers to handle thousands of real-time Chess960 games simultaneously with minimal latency.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 sm:p-8 hover:border-orange-300/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
              <div className="inline-block p-3 sm:p-4 bg-gradient-to-br from-orange-300 to-orange-400 rounded-lg mb-4 sm:mb-6">
                <Code className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-orange-400">Active Development</h3>
              <p className="text-sm sm:text-base text-[#c1b9ad] light:text-[#5a5449] leading-relaxed">
                Full-time development to add new features, fix bugs, and continuously improve the platform.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={300}>
            <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 sm:p-8 hover:border-orange-300/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
              <div className="inline-block p-3 sm:p-4 bg-gradient-to-br from-orange-300 to-orange-400 rounded-lg mb-4 sm:mb-6">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-orange-400">Free for Everyone</h3>
              <p className="text-sm sm:text-base text-[#c1b9ad] light:text-[#5a5449] leading-relaxed">
                Keeping Chess960 completely free with no ads, no premium features, and no paywalls. Forever.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </AnimatedSection>

      <AnimatedSection className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Choose Your Support Level</h2>

        {/* Mobile: Collapsible sections */}
        <div className="md:hidden space-y-3 mb-8">
          {/* One-Time Donation - Mobile */}
          <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl overflow-hidden shadow-lg">
            <button
              onClick={() => toggleDonationType('one-time')}
              className="w-full px-4 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-[#33302c] light:hover:bg-[#f5f1ea] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg sm:text-xl font-semibold text-orange-400">One-Time Donation</span>
              </div>
              {openDonationType === 'one-time' ? (
                <ChevronUp className="h-5 w-5 text-orange-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[#a0958a] light:text-[#5a5449] flex-shrink-0" />
              )}
            </button>
            {openDonationType === 'one-time' && (
              <div className="px-3 sm:px-4 pb-4 space-y-3">
                <div className="bg-[#33302c] light:bg-[#faf7f2] border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4 hover:border-orange-300/50 transition-all duration-200">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold text-orange-400">$5</div>
                        <p className="text-xs text-[#c1b9ad] light:text-[#5a5449]">Buy us a coffee</p>
                      </div>
                      <DonationButton amount={5} />
                    </div>
                  </div>
                </div>

                <div className="bg-[#33302c] light:bg-[#faf7f2] border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4 hover:border-orange-300/50 transition-all duration-200">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold text-orange-400">$10</div>
                        <p className="text-xs text-[#c1b9ad] light:text-[#5a5449]">Support development</p>
                      </div>
                      <DonationButton amount={10} />
                    </div>
                  </div>
                </div>

                <div className="bg-[#33302c] light:bg-[#faf7f2] border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4 hover:border-orange-300/50 transition-all duration-200">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold text-orange-400">$25</div>
                        <p className="text-xs text-[#c1b9ad] light:text-[#5a5449]">Very generous contribution</p>
                      </div>
                      <DonationButton amount={25} />
                    </div>
                  </div>
                </div>

                <div className="bg-[#33302c] light:bg-[#faf7f2] border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4 hover:border-orange-300/50 transition-all duration-200">
                  <div className="mb-3">
                    <div className="text-xl font-bold text-orange-400">Custom</div>
                    <p className="text-xs text-[#c1b9ad] light:text-[#5a5449]">Choose your own amount</p>
                  </div>
                  <CustomDonation />
                </div>
              </div>
            )}
          </div>

          {/* Monthly Support - Mobile */}
          <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl overflow-hidden shadow-lg">
            <button
              onClick={() => toggleDonationType('monthly')}
              className="w-full px-4 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-[#33302c] light:hover:bg-[#f5f1ea] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg sm:text-xl font-semibold text-orange-400">Monthly Support</span>
              </div>
              {openDonationType === 'monthly' ? (
                <ChevronUp className="h-5 w-5 text-orange-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[#a0958a] light:text-[#5a5449] flex-shrink-0" />
              )}
            </button>
            {openDonationType === 'monthly' && (
              <div className="px-3 sm:px-4 pb-4 space-y-3">
                <div className="bg-[#33302c] light:bg-[#faf7f2] border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4 hover:border-orange-300/50 transition-all duration-200">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold text-orange-400">$5/month</div>
                        <p className="text-xs text-[#c1b9ad] light:text-[#5a5449]">Basic support</p>
                      </div>
                      <DonationButton amount={5} type="subscription" />
                    </div>
                  </div>
                </div>

                <div className="bg-[#33302c] light:bg-[#faf7f2] border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4 hover:border-orange-300/50 transition-all duration-200">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold text-orange-400">$10/month</div>
                        <p className="text-xs text-[#c1b9ad] light:text-[#5a5449]">Regular supporter</p>
                      </div>
                      <DonationButton amount={10} type="subscription" />
                    </div>
                  </div>
                </div>

                <div className="bg-[#33302c] light:bg-[#faf7f2] border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4 hover:border-orange-300/50 transition-all duration-200">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold text-orange-400">$25/month</div>
                        <p className="text-xs text-[#c1b9ad] light:text-[#5a5449]">Premium supporter</p>
                      </div>
                      <DonationButton amount={25} type="subscription" />
                    </div>
                  </div>
                </div>

                <div className="bg-[#33302c] light:bg-[#faf7f2] border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4 hover:border-orange-300/50 transition-all duration-200">
                  <div className="mb-3">
                    <div className="text-xl font-bold text-orange-400">Custom</div>
                    <p className="text-xs text-[#c1b9ad] light:text-[#5a5449]">Choose your own amount</p>
                  </div>
                  <CustomDonation type="subscription" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop: Side-by-side grid */}
        <div className="hidden md:grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xl font-semibold text-center mb-6 text-orange-400">One-Time Donation</h3>
            <div className="space-y-4">
              <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 hover:border-orange-300 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-400 mb-1">$5</div>
                    <p className="text-sm text-[#c1b9ad] light:text-[#5a5449]">Buy us a coffee</p>
                  </div>
                  <div className="ml-4">
                    <DonationButton amount={5} />
                  </div>
                </div>
              </div>

              <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 hover:border-orange-300 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-400 mb-1">$10</div>
                    <p className="text-sm text-[#c1b9ad] light:text-[#5a5449]">Support development</p>
                  </div>
                  <div className="ml-4">
                    <DonationButton amount={10} />
                  </div>
                </div>
              </div>

              <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 hover:border-orange-300 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-400 mb-1">$25</div>
                    <p className="text-sm text-[#c1b9ad] light:text-[#5a5449]">Very generous contribution</p>
                  </div>
                  <div className="ml-4">
                    <DonationButton amount={25} />
                  </div>
                </div>
              </div>

              <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 hover:border-orange-300 transition-all duration-300">
                <div className="mb-4">
                  <div className="text-2xl font-bold text-orange-400 mb-1">Custom</div>
                  <p className="text-sm text-[#c1b9ad] light:text-[#5a5449]">Choose your own amount</p>
                </div>
                <CustomDonation />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-center mb-6 text-orange-400">Monthly Support</h3>
            <div className="space-y-4">
              <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 hover:border-orange-300 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-400 mb-1">$5/month</div>
                    <p className="text-sm text-[#c1b9ad] light:text-[#5a5449]">Basic support</p>
                  </div>
                  <div className="ml-4">
                    <DonationButton amount={5} type="subscription" />
                  </div>
                </div>
              </div>

              <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 hover:border-orange-300 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-400 mb-1">$10/month</div>
                    <p className="text-sm text-[#c1b9ad] light:text-[#5a5449]">Regular supporter</p>
                  </div>
                  <div className="ml-4">
                    <DonationButton amount={10} type="subscription" />
                  </div>
                </div>
              </div>

              <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 hover:border-orange-300 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-400 mb-1">$25/month</div>
                    <p className="text-sm text-[#c1b9ad] light:text-[#5a5449]">Premium supporter</p>
                  </div>
                  <div className="ml-4">
                    <DonationButton amount={25} type="subscription" />
                  </div>
                </div>
              </div>

              <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 hover:border-orange-300 transition-all duration-300">
                <div className="mb-4">
                  <div className="text-2xl font-bold text-orange-400 mb-1">Custom</div>
                  <p className="text-sm text-[#c1b9ad] light:text-[#5a5449]">Choose your own amount</p>
                </div>
                <CustomDonation type="subscription" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 mb-8">
          <p className="text-sm text-[#a0958a] light:text-[#5a5449] text-center">
            You must be logged in to create a subscription. Cancel anytime from your profile settings.
          </p>
        </div>

        <p className="text-center text-[#a0958a] light:text-[#5a5449] text-sm mt-8">
          All donations are processed securely through Stripe. We never see your payment details.
        </p>
      </AnimatedSection>

      <AnimatedSection className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl overflow-hidden hover:border-orange-300/50 transition-all duration-300"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full px-4 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-[#33302c] light:hover:bg-[#f5f1ea] transition-colors"
              >
                <span className="font-semibold text-white light:text-black text-sm sm:text-base pr-2">{faq.question}</span>
                {openFaq === index ? (
                  <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-[#a0958a] light:text-[#5a5449] flex-shrink-0" />
                )}
              </button>
              {openFaq === index && (
                <div className="px-4 sm:px-6 pb-4 text-[#c1b9ad] light:text-[#5a5449] leading-relaxed text-sm sm:text-base">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection className="max-w-3xl mx-auto px-4 py-12 sm:py-16 text-center">
        <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 sm:p-8">
          <Mail className="h-10 w-10 sm:h-12 sm:w-12 text-orange-400 mx-auto mb-4 sm:mb-6" />
          <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Have Questions?</h3>
          <p className="text-sm sm:text-base text-[#c1b9ad] light:text-[#5a5449] mb-4 sm:mb-6 leading-relaxed">
            If you have any questions about donations, need help with payment, or want to discuss other ways to support Chess960, we&apos;re here to help!
          </p>
          <a
            href="mailto:support@chess960.game"
            className="inline-block bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white font-semibold px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl text-sm sm:text-base"
          >
            Contact Support
          </a>
        </div>
      </AnimatedSection>

      <AnimatedSection className="max-w-4xl mx-auto px-4 py-8 sm:py-12 text-center">
        <p className="text-sm sm:text-base text-[#a0958a] light:text-[#5a5449] leading-relaxed">
          Thank you for considering supporting Chess960. Your contribution, no matter the size,
          helps us maintain a fast, free, and fair Chess960 platform for players around the world.
        </p>
        <div className="mt-6 sm:mt-8">
          <Link
            href="/"
            className="text-orange-400 hover:text-orange-400 font-semibold transition-colors text-sm sm:text-base"
          >
            Back to Home
          </Link>
        </div>
      </AnimatedSection>
    </div>
  );
}
