'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { User, Bell, Palette, Shield, Trash2, CreditCard, Sun, Moon, Key, Eye, EyeOff, Check } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { getUserContextFromCookies } from '@chess960/utils';

// Custom Checkbox Component
const CustomCheckbox = ({ checked, onChange, className = '' }: { checked: boolean; onChange: (checked: boolean) => void; className?: string }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-5 h-5 rounded border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400/50 ${
        checked
          ? 'bg-orange-400/20 border-orange-400 hover:bg-orange-400/30'
          : 'bg-[#2b2824] light:bg-white border-[#4a453e] light:border-[#d4caba] hover:border-[#5a5449] light:hover:border-[#a0958a]'
      } ${className}`}
    >
      {checked && (
        <Check className="absolute inset-0 w-4 h-4 text-orange-400 m-auto" strokeWidth={3} />
      )}
    </button>
  );
};

type SettingsTab = 'account' | 'preferences' | 'privacy' | 'notifications' | 'security' | 'subscription';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Account settings
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [countrySearch, setCountrySearch] = useState<string | null>(null);
  const [canChangeUsername, setCanChangeUsername] = useState(true);

  // Privacy settings
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [allowMessages, setAllowMessages] = useState(true);
  const [allowGameMessages, setAllowGameMessages] = useState(true);
  const [allowChallenges, setAllowChallenges] = useState('REGISTERED');
  const [allowTakebacks, setAllowTakebacks] = useState(true);

  // Preferences
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Subscription
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  // Notifications
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [gameNotifications, setGameNotifications] = useState(true);
  const [tournamentNotifications, setTournamentNotifications] = useState(true);

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(true); // Assume true until we know otherwise
  const [authValidated, setAuthValidated] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Wait for session status to be determined
    if (status === 'loading') {
      setAuthValidated(false);
      return;
    }

    // Check both NextAuth session and auth-token cookie for proper state validation
    const cookieContext = getUserContextFromCookies();
    const isAuthenticatedViaCookie = cookieContext.isAuth && cookieContext.type === 'user';
    
    // If NextAuth says unauthenticated, reset validation and redirect
    if (status === 'unauthenticated') {
      setAuthValidated(false);
      // If there's a guest token, redirect to guest profile instead
      if (cookieContext.type === 'guest') {
        router.push('/guest/profile');
      } else {
        router.push('/auth/signin');
      }
      return;
    }

    // If NextAuth says authenticated, verify with auth-token cookie
    if (status === 'authenticated' && session?.user) {
      // If NextAuth session exists but auth-token says guest or doesn't exist,
      // user is logged out - redirect appropriately
      if (!isAuthenticatedViaCookie) {
        // User logged out - clear any stale session data
        setAuthValidated(false);
        if (cookieContext.type === 'guest') {
          router.push('/guest/profile');
        } else {
          router.push('/auth/signin');
        }
        return;
      }

      // Both NextAuth and auth-token confirm user is authenticated
      const user = session.user as { handle?: string; email?: string };
      setUsername(user.handle || '');
      setEmail(user.email || '');
      // Fetch user info including full name and country
      fetchUserInfo();
      // Load preferences from localStorage
      loadPreferences();
      setAuthValidated(true);
    }
  }, [status, session, router]);


  const loadPreferences = () => {
    const saved = localStorage.getItem('chess_preferences');
    if (saved) {
      const prefs = JSON.parse(saved);
      setSoundEnabled(prefs.soundEnabled ?? true);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/user/info');
      if (response.ok) {
        const data = await response.json();
        setCanChangeUsername(!data.handleChangedAt);
        setFullName(data.fullName || '');
        setCountry(data.country || '');
        setAllowFriendRequests(data.allowFriendRequests ?? true);
        setAllowMessages(data.allowMessages ?? true);
        setAllowGameMessages(data.allowGameMessages ?? true);
        setAllowChallenges(data.allowChallenges ?? 'REGISTERED');
        setAllowTakebacks(data.allowTakebacks ?? true);
        setHasActiveSubscription(data.hasActiveSubscription ?? false);
        // Load notification settings from user data
        setEmailNotifications(data.emailNotifications ?? true);
        setPushNotifications(data.pushNotifications ?? true);
        setGameNotifications(data.gameNotifications ?? true);
        setTournamentNotifications(data.tournamentNotifications ?? true);
        // Check if user has a password (for password change feature)
        setHasPassword(data.hasPassword ?? true);
      } else if (response.status === 401 || response.status === 403) {
        // User is not authenticated - redirect appropriately
        const cookieContext = getUserContextFromCookies();
        if (cookieContext.type === 'guest') {
          router.push('/guest/profile');
        } else {
          router.push('/auth/signin');
        }
      }
    } catch (_error) {
      console.error('Failed to fetch user info:', _error);
      // On error, check if we should redirect
      const cookieContext = getUserContextFromCookies();
      if (!cookieContext.isAuth || cookieContext.type !== 'user') {
        if (cookieContext.type === 'guest') {
          router.push('/guest/profile');
        } else {
          router.push('/auth/signin');
        }
      }
    }
  };


  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, fullName, country, allowFriendRequests, allowMessages, allowGameMessages, allowChallenges, allowTakebacks }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Failed to update profile');
      } else {
        setMessage('Profile updated successfully!');
        // Refresh session if username changed
        if (data.usernameChanged) {
          window.location.reload();
        }
      }
    } catch {
      setMessage('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    setMessage('');

    try {
      const preferences = {
        soundEnabled,
      };

      // Save to localStorage
      localStorage.setItem('chess_preferences', JSON.stringify(preferences));

      setMessage('Preferences saved successfully!');

      // Trigger a reload if user is on game page to apply changes
      window.dispatchEvent(new Event('preferences-updated'));
    } catch {
      setMessage('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  // Save notification settings
  const saveNotificationSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/notification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailNotifications,
          pushNotifications,
          gameNotifications,
          tournamentNotifications,
        }),
      });

      if (response.ok) {
        setMessage('Notification settings saved successfully!');
      } else {
        const error = await response.json();
        setMessage(error.error || 'Failed to save notification settings');
      }
    } catch (_error) {
      console.error('Failed to save notification settings:', _error);
      setMessage('Failed to save notification settings');
    } finally {
      setLoading(false);
    }
  };


  const tabs = [
    { id: 'account' as SettingsTab, label: 'Account', icon: User },
    { id: 'preferences' as SettingsTab, label: 'Preferences', icon: Palette },
    { id: 'privacy' as SettingsTab, label: 'Privacy', icon: Shield },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
    { id: 'security' as SettingsTab, label: 'Security', icon: Key },
    ...(hasActiveSubscription ? [{ id: 'subscription' as SettingsTab, label: 'Subscription', icon: CreditCard }] : []),
  ];

  const countries = [
    { code: 'AF', name: 'Afghanistan' }, { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' },
    { code: 'AD', name: 'Andorra' }, { code: 'AO', name: 'Angola' }, { code: 'AG', name: 'Antigua and Barbuda' },
    { code: 'AR', name: 'Argentina' }, { code: 'AM', name: 'Armenia' }, { code: 'AU', name: 'Australia' },
    { code: 'AT', name: 'Austria' }, { code: 'AZ', name: 'Azerbaijan' }, { code: 'BS', name: 'Bahamas' },
    { code: 'BH', name: 'Bahrain' }, { code: 'BD', name: 'Bangladesh' }, { code: 'BB', name: 'Barbados' },
    { code: 'BY', name: 'Belarus' }, { code: 'BE', name: 'Belgium' }, { code: 'BZ', name: 'Belize' },
    { code: 'BJ', name: 'Benin' }, { code: 'BT', name: 'Bhutan' }, { code: 'BO', name: 'Bolivia' },
    { code: 'BA', name: 'Bosnia and Herzegovina' }, { code: 'BW', name: 'Botswana' }, { code: 'BR', name: 'Brazil' },
    { code: 'BN', name: 'Brunei' }, { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' },
    { code: 'BI', name: 'Burundi' }, { code: 'CV', name: 'Cabo Verde' }, { code: 'KH', name: 'Cambodia' },
    { code: 'CM', name: 'Cameroon' }, { code: 'CA', name: 'Canada' }, { code: 'CF', name: 'Central African Republic' },
    { code: 'TD', name: 'Chad' }, { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' },
    { code: 'CO', name: 'Colombia' }, { code: 'KM', name: 'Comoros' }, { code: 'CG', name: 'Congo' },
    { code: 'CR', name: 'Costa Rica' }, { code: 'HR', name: 'Croatia' }, { code: 'CU', name: 'Cuba' },
    { code: 'CY', name: 'Cyprus' }, { code: 'CZ', name: 'Czech Republic' }, { code: 'DK', name: 'Denmark' },
    { code: 'DJ', name: 'Djibouti' }, { code: 'DM', name: 'Dominica' }, { code: 'DO', name: 'Dominican Republic' },
    { code: 'EC', name: 'Ecuador' }, { code: 'EG', name: 'Egypt' }, { code: 'SV', name: 'El Salvador' },
    { code: 'GQ', name: 'Equatorial Guinea' }, { code: 'ER', name: 'Eritrea' }, { code: 'EE', name: 'Estonia' },
    { code: 'SZ', name: 'Eswatini' }, { code: 'ET', name: 'Ethiopia' }, { code: 'FJ', name: 'Fiji' },
    { code: 'FI', name: 'Finland' }, { code: 'FR', name: 'France' }, { code: 'GA', name: 'Gabon' },
    { code: 'GM', name: 'Gambia' }, { code: 'GE', name: 'Georgia' }, { code: 'DE', name: 'Germany' },
    { code: 'GH', name: 'Ghana' }, { code: 'GR', name: 'Greece' }, { code: 'GD', name: 'Grenada' },
    { code: 'GT', name: 'Guatemala' }, { code: 'GN', name: 'Guinea' }, { code: 'GW', name: 'Guinea-Bissau' },
    { code: 'GY', name: 'Guyana' }, { code: 'HT', name: 'Haiti' }, { code: 'HN', name: 'Honduras' },
    { code: 'HU', name: 'Hungary' }, { code: 'IS', name: 'Iceland' }, { code: 'IN', name: 'India' },
    { code: 'ID', name: 'Indonesia' }, { code: 'IR', name: 'Iran' }, { code: 'IQ', name: 'Iraq' },
    { code: 'IE', name: 'Ireland' }, { code: 'IL', name: 'Israel' }, { code: 'IT', name: 'Italy' },
    { code: 'JM', name: 'Jamaica' }, { code: 'JP', name: 'Japan' }, { code: 'JO', name: 'Jordan' },
    { code: 'KZ', name: 'Kazakhstan' }, { code: 'KE', name: 'Kenya' }, { code: 'KI', name: 'Kiribati' },
    { code: 'KP', name: 'North Korea' }, { code: 'KR', name: 'South Korea' }, { code: 'KW', name: 'Kuwait' },
    { code: 'KG', name: 'Kyrgyzstan' }, { code: 'LA', name: 'Laos' }, { code: 'LV', name: 'Latvia' },
    { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' }, { code: 'LR', name: 'Liberia' },
    { code: 'LY', name: 'Libya' }, { code: 'LI', name: 'Liechtenstein' }, { code: 'LT', name: 'Lithuania' },
    { code: 'LU', name: 'Luxembourg' }, { code: 'MG', name: 'Madagascar' }, { code: 'MW', name: 'Malawi' },
    { code: 'MY', name: 'Malaysia' }, { code: 'MV', name: 'Maldives' }, { code: 'ML', name: 'Mali' },
    { code: 'MT', name: 'Malta' }, { code: 'MH', name: 'Marshall Islands' }, { code: 'MR', name: 'Mauritania' },
    { code: 'MU', name: 'Mauritius' }, { code: 'MX', name: 'Mexico' }, { code: 'FM', name: 'Micronesia' },
    { code: 'MD', name: 'Moldova' }, { code: 'MC', name: 'Monaco' }, { code: 'MN', name: 'Mongolia' },
    { code: 'ME', name: 'Montenegro' }, { code: 'MA', name: 'Morocco' }, { code: 'MZ', name: 'Mozambique' },
    { code: 'MM', name: 'Myanmar' }, { code: 'NA', name: 'Namibia' }, { code: 'NR', name: 'Nauru' },
    { code: 'NP', name: 'Nepal' }, { code: 'NL', name: 'Netherlands' }, { code: 'NZ', name: 'New Zealand' },
    { code: 'NI', name: 'Nicaragua' }, { code: 'NE', name: 'Niger' }, { code: 'NG', name: 'Nigeria' },
    { code: 'MK', name: 'North Macedonia' }, { code: 'NO', name: 'Norway' }, { code: 'OM', name: 'Oman' },
    { code: 'PK', name: 'Pakistan' }, { code: 'PW', name: 'Palau' },
    { code: 'PA', name: 'Panama' }, { code: 'PG', name: 'Papua New Guinea' }, { code: 'PY', name: 'Paraguay' },
    { code: 'PE', name: 'Peru' }, { code: 'PH', name: 'Philippines' }, { code: 'PL', name: 'Poland' },
    { code: 'PT', name: 'Portugal' }, { code: 'QA', name: 'Qatar' }, { code: 'RO', name: 'Romania' },
    { code: 'RU', name: 'Russia' }, { code: 'RW', name: 'Rwanda' }, { code: 'KN', name: 'Saint Kitts and Nevis' },
    { code: 'LC', name: 'Saint Lucia' }, { code: 'VC', name: 'Saint Vincent and the Grenadines' },
    { code: 'WS', name: 'Samoa' }, { code: 'SM', name: 'San Marino' }, { code: 'ST', name: 'Sao Tome and Principe' },
    { code: 'SA', name: 'Saudi Arabia' }, { code: 'SN', name: 'Senegal' }, { code: 'RS', name: 'Serbia' },
    { code: 'SC', name: 'Seychelles' }, { code: 'SL', name: 'Sierra Leone' }, { code: 'SG', name: 'Singapore' },
    { code: 'SK', name: 'Slovakia' }, { code: 'SI', name: 'Slovenia' }, { code: 'SB', name: 'Solomon Islands' },
    { code: 'SO', name: 'Somalia' }, { code: 'ZA', name: 'South Africa' }, { code: 'SS', name: 'South Sudan' },
    { code: 'ES', name: 'Spain' }, { code: 'LK', name: 'Sri Lanka' }, { code: 'SD', name: 'Sudan' },
    { code: 'SR', name: 'Suriname' }, { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' },
    { code: 'SY', name: 'Syria' }, { code: 'TW', name: 'Taiwan' }, { code: 'TJ', name: 'Tajikistan' },
    { code: 'TZ', name: 'Tanzania' }, { code: 'TH', name: 'Thailand' }, { code: 'TL', name: 'Timor-Leste' },
    { code: 'TG', name: 'Togo' }, { code: 'TO', name: 'Tonga' }, { code: 'TT', name: 'Trinidad and Tobago' },
    { code: 'TN', name: 'Tunisia' }, { code: 'TR', name: 'Turkey' }, { code: 'TM', name: 'Turkmenistan' },
    { code: 'TV', name: 'Tuvalu' }, { code: 'UG', name: 'Uganda' }, { code: 'UA', name: 'Ukraine' },
    { code: 'AE', name: 'United Arab Emirates' }, { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' }, { code: 'UY', name: 'Uruguay' }, { code: 'UZ', name: 'Uzbekistan' },
    { code: 'VU', name: 'Vanuatu' }, { code: 'VA', name: 'Vatican City' }, { code: 'VE', name: 'Venezuela' },
    { code: 'VN', name: 'Vietnam' }, { code: 'YE', name: 'Yemen' }, { code: 'ZM', name: 'Zambia' },
    { code: 'ZW', name: 'Zimbabwe' }
  ];

  const filteredCountries = countrySearch
    ? countries.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : [];

  // Show loading while session is loading or while validating authentication
  if (status === 'loading' || (!authValidated && status === 'authenticated')) {
    return (
      <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-300 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Don't render content if not authenticated and validated
  if (status === 'unauthenticated' || !authValidated) {
    return (
      <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-300 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black py-4 sm:py-8 md:py-12">
      <div className="max-w-5xl mx-auto px-3 sm:px-4">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent mb-4 sm:mb-6 md:mb-8">
          Settings
        </h1>

        {/* Tabs - scrollable on mobile */}
        <div className="flex space-x-1 sm:space-x-2 mb-4 sm:mb-6 md:mb-8 border-b border-[#3e3a33] light:border-[#d4caba] overflow-x-auto scrollbar-hide pb-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base font-medium transition-colors relative whitespace-nowrap flex-shrink-0 rounded-lg ${
                activeTab === id
                  ? 'text-orange-400 bg-orange-400/10'
                  : 'text-[#a0958a] light:text-[#5a5449] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f5f1ea]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
              {activeTab === id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-300 rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg text-sm sm:text-base ${
              message.includes('success')
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {message}
          </div>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-2xl border border-[#474239] light:border-[#d4caba] p-4 sm:p-5 md:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white light:text-black mb-4 sm:mb-6">Account Information</h2>

              <form onSubmit={handleUpdateAccount} className="space-y-4 sm:space-y-6">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    minLength={3}
                    maxLength={20}
                    disabled={!canChangeUsername}
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border rounded-lg placeholder-[#6b6460] light:placeholder-[#a0958a] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      canChangeUsername
                        ? 'bg-[#2a2723] light:bg-white border-[#474239] light:border-[#d4caba] text-white light:text-black'
                        : 'bg-[#2a2723]/50 light:bg-[#f5f1ea] border-[#474239] light:border-[#d4caba] text-[#a0958a] light:text-[#5a5449] cursor-not-allowed'
                    }`}
                  />
                  <p className="mt-2 text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                    {canChangeUsername
                      ? '3-20 characters, letters, numbers, hyphens and underscores. Username can only be changed once.'
                      : 'Username has already been changed and cannot be modified'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#2a2723]/50 light:bg-[#f5f1ea] border border-[#474239] light:border-[#d4caba] rounded-lg text-[#a0958a] light:text-[#5a5449] cursor-not-allowed"
                  />
                  <p className="mt-2 text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-2">
                    Full Name <span className="text-[#6b6460] light:text-[#a0958a]">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                    placeholder="Your full name"
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#2a2723] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#a0958a] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-2">
                    Country <span className="text-[#6b6460] light:text-[#a0958a]">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={countrySearch !== null ? countrySearch : (countries.find(c => c.code === country)?.name || '')}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCountrySearch(value);
                        if (value === '') {
                          setCountry('');
                        }
                      }}
                      onFocus={() => setCountrySearch('')}
                      placeholder="Search for a country..."
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#2a2723] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#a0958a] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    {countrySearch !== null && countrySearch !== '' && (
                      <div className="absolute z-10 w-full mt-2 bg-[#2a2926] light:bg-white border border-[#454038] light:border-[#d4caba] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCountry(c.code);
                                setCountrySearch(null);
                              }}
                              className="w-full text-left px-3 sm:px-4 py-2 text-sm sm:text-base text-white light:text-black hover:bg-[#33302c] light:hover:bg-[#f5f1ea] transition-colors"
                            >
                              {c.name}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">No countries found</div>
                        )}
                      </div>
                    )}
                  </div>
                  {country && countrySearch === null && (
                    <p className="mt-2 text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                      Selected: {countries.find(c => c.code === country)?.name}
                      {' · '}
                      <button
                        type="button"
                        onClick={() => {
                          setCountry('');
                          setCountrySearch(null);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        Clear
                      </button>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || username.length < 3}
                  className="w-full bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white py-2.5 sm:py-3 px-4 text-sm sm:text-base rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-2xl border border-[#474239] light:border-[#d4caba] p-4 sm:p-5 md:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white light:text-black mb-4 sm:mb-6">Game Preferences</h2>

              <div className="space-y-4 sm:space-y-6">
                {/* Color Theme */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-3">
                    Color Theme
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 transition-all ${
                        theme === 'dark'
                          ? 'border-orange-300 bg-orange-300/20'
                          : 'border-[#474239] light:border-[#d4caba] hover:border-[#5a5449] light:hover:border-[#a0958a]'
                      }`}
                    >
                      <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-sm sm:text-base">Dark</span>
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 transition-all ${
                        theme === 'light'
                          ? 'border-orange-300 bg-orange-300/20'
                          : 'border-[#474239] light:border-[#d4caba] hover:border-[#5a5449] light:hover:border-[#a0958a]'
                      }`}
                    >
                      <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-sm sm:text-base">Light</span>
                    </button>
                  </div>
                </div>

                {/* Board Themes */}
                <ThemeSettings />

                {/* Sound Settings */}
                <div>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-1">
                        Move Sounds
                      </div>
                      <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                        Play sound when moves are made
                      </div>
                    </div>
                    <CustomCheckbox
                      checked={soundEnabled}
                      onChange={setSoundEnabled}
                    />
                  </label>
                </div>

                <button
                  onClick={handleSavePreferences}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white py-2.5 sm:py-3 px-4 text-sm sm:text-base rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Tab */}
        {activeTab === 'privacy' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-2xl border border-[#474239] light:border-[#d4caba] p-4 sm:p-5 md:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white light:text-black mb-4 sm:mb-6">Privacy Settings</h2>

              <div className="space-y-4 sm:space-y-6">
                <div>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1 mr-4">
                      <div className="text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-1">
                        Allow Friend Requests
                      </div>
                      <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                        Let other users send you friend requests
                      </div>
                    </div>
                    <CustomCheckbox
                      checked={allowFriendRequests}
                      onChange={setAllowFriendRequests}
                    />
                  </label>
                </div>

                <div className="border-t border-[#3e3a33] light:border-[#d4caba] pt-4 sm:pt-6">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1 mr-4">
                      <div className="text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-1">
                        Allow Messages
                      </div>
                      <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                        Allow your friends to send you messages
                      </div>
                    </div>
                    <CustomCheckbox
                      checked={allowMessages}
                      onChange={setAllowMessages}
                    />
                  </label>
                </div>

                <div className="border-t border-[#3e3a33] light:border-[#d4caba] pt-4 sm:pt-6">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1 mr-4">
                      <div className="text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-1">
                        Allow Game Messages
                      </div>
                      <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                        Allow players to send you messages during and after games
                      </div>
                    </div>
                    <CustomCheckbox
                      checked={allowGameMessages}
                      onChange={setAllowGameMessages}
                    />
                  </label>
                </div>

                <div className="border-t border-[#3e3a33] light:border-[#d4caba] pt-4 sm:pt-6">
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-1">
                      Allow Challenges
                    </div>
                    <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] mb-3">
                      Control who can challenge you to a game
                    </div>
                  </div>
                  <CustomSelect
                    value={allowChallenges}
                    onChange={setAllowChallenges}
                    options={[
                      { value: 'NEVER', label: 'Never' },
                      { value: 'RATING_RANGE', label: 'Only if rating is within ±200' },
                      { value: 'FRIENDS_ONLY', label: 'Only friends' },
                      { value: 'REGISTERED', label: 'Only registered users' },
                      { value: 'EVERYONE', label: 'Everyone' }
                    ]}
                  />
                </div>

                <div className="border-t border-[#3e3a33] light:border-[#d4caba] pt-4 sm:pt-6">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1 mr-4">
                      <div className="text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-1">
                        Allow Takeback Requests
                      </div>
                      <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                        Allow opponents to request to undo their last move during games
                      </div>
                    </div>
                    <CustomCheckbox
                      checked={allowTakebacks}
                      onChange={setAllowTakebacks}
                    />
                  </label>
                </div>

                <button
                  onClick={handleUpdateAccount}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white py-2.5 sm:py-3 px-4 text-sm sm:text-base rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Saving...' : 'Save Privacy Settings'}
                </button>

                <div className="border-t border-[#3e3a33] light:border-[#d4caba] pt-4 sm:pt-6">
                  <h3 className="text-base sm:text-lg font-semibold text-red-400 mb-3 sm:mb-4 flex items-center">
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Danger Zone
                  </h3>
                  <button
                    className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-red-600/20 border border-red-600/50 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-2xl border border-[#474239] light:border-[#d4caba] p-4 sm:p-5 md:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white light:text-black mb-4 sm:mb-6">Notification Settings</h2>

              <div className="space-y-4 sm:space-y-6">
                <div>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1 mr-4">
                      <div className="text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-1">
                        Email Notifications
                      </div>
                      <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                        Receive notifications via email
                      </div>
                    </div>
                    <CustomCheckbox
                      checked={emailNotifications}
                      onChange={setEmailNotifications}
                    />
                  </label>
                </div>

                <div className="border-t border-[#3e3a33] light:border-[#d4caba] pt-4 sm:pt-6">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1 mr-4">
                      <div className="text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-1">
                        Push Notifications
                      </div>
                      <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                        Receive push notifications in your browser
                      </div>
                    </div>
                    <CustomCheckbox
                      checked={pushNotifications}
                      onChange={setPushNotifications}
                    />
                  </label>
                </div>

                <div className="border-t border-[#3e3a33] light:border-[#d4caba] pt-4 sm:pt-6">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1 mr-4">
                      <div className="text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-1">
                        Game Notifications
                      </div>
                      <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                        Notifications about your games (moves, results, etc.)
                      </div>
                    </div>
                    <CustomCheckbox
                      checked={gameNotifications}
                      onChange={setGameNotifications}
                    />
                  </label>
                </div>

                <div className="border-t border-[#3e3a33] light:border-[#d4caba] pt-4 sm:pt-6">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1 mr-4">
                      <div className="text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-1">
                        Tournament Notifications
                      </div>
                      <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                        Notifications about tournaments and events
                      </div>
                    </div>
                    <CustomCheckbox
                      checked={tournamentNotifications}
                      onChange={setTournamentNotifications}
                    />
                  </label>
                </div>

                <button
                  onClick={saveNotificationSettings}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white py-2.5 sm:py-3 px-4 text-sm sm:text-base rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Saving...' : 'Save Notification Settings'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-2xl border border-[#474239] light:border-[#d4caba] p-4 sm:p-5 md:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white light:text-black mb-4 sm:mb-6">Security Settings</h2>

              <div className="space-y-4 sm:space-y-6">
                {/* Password Change */}
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white light:text-black mb-4">Change Password</h3>

                  {!hasPassword ? (
                    <div className="p-4 bg-[#2a2723]/30 light:bg-[#f5f1ea] rounded-lg border border-[#474239] light:border-[#d4caba]">
                      <p className="text-sm sm:text-base text-[#c1b9ad] light:text-[#5a5449]">
                        You signed in using OAuth (Google, etc.). Password management is handled by your OAuth provider.
                        If you&apos;d like to set a password for this account, please contact support.
                      </p>
                    </div>
                  ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#2a2723] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#a0958a] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent pr-10"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#a0958a] light:text-[#5a5449] hover:text-white light:hover:text-black p-1"
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#2a2723] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#a0958a] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent pr-10"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#a0958a] light:text-[#5a5449] hover:text-white light:hover:text-black p-1"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-[#2a2723] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#a0958a] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent pr-10"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#a0958a] light:text-[#5a5449] hover:text-white light:hover:text-black p-1"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        if (newPassword !== confirmPassword) {
                          setMessage('Passwords do not match');
                          return;
                        }
                        if (newPassword.length < 8) {
                          setMessage('Password must be at least 8 characters long');
                          return;
                        }
                        setLoading(true);
                        setMessage('');
                        try {
                          const response = await fetch('/api/user/change-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ currentPassword, newPassword }),
                          });
                          const data = await response.json();
                          if (response.ok) {
                            setMessage('Password changed successfully!');
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                          } else {
                            setMessage(data.error || 'Failed to change password');
                          }
                        } catch {
                          setMessage('Something went wrong');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                      className="w-full bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white py-2.5 sm:py-3 px-4 text-sm sm:text-base rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {loading ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-2xl border border-[#474239] light:border-[#d4caba] p-4 sm:p-5 md:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white light:text-black mb-4 sm:mb-6">Manage Subscription</h2>

              <div className="space-y-4 sm:space-y-6">
                <p className="text-sm sm:text-base text-[#c1b9ad] light:text-[#5a5449]">
                  Manage your subscription, update payment methods, view invoices, and cancel your subscription through our secure billing portal.
                </p>

                <button
                  onClick={async () => {
                    setLoading(true);
                    setMessage('');
                    try {
                      const response = await fetch('/api/stripe/create-portal-session', {
                        method: 'POST',
                      });
                      const data = await response.json();
                      if (response.ok && data.url) {
                        window.location.href = data.url;
                      } else {
                        setMessage(data.error || 'Failed to open billing portal');
                      }
                    } catch {
                      setMessage('Something went wrong');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white py-2.5 sm:py-3 px-4 text-sm sm:text-base rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Loading...' : 'Manage Subscription'}
                </button>

                <div className="border-t border-[#3e3a33] pt-4 sm:pt-6">
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
                    What you can do in the billing portal:
                  </h3>
                  <ul className="space-y-2 text-xs sm:text-sm text-[#a0958a]">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Update payment method</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>View payment history and invoices</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Cancel your subscription</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Change subscription plan</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-[#2a2723]/50 border border-[#474239] rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-[#a0958a]">
                    You&apos;ll be redirected to a secure Stripe portal where you can manage all aspects of your subscription.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}