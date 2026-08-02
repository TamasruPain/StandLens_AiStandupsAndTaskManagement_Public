'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Bell, User, Save, Loader2 } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';
import { ConfirmModal } from '@/components/ui/confirm-modal';

export default function SettingsPage() {
  const { data: session, isPending } = useSession();
  const toast = useToast();

  const [name, setName] = useState(() => session?.user?.name || 'Alex Rivera');
  const [email] = useState(() => session?.user?.email || 'alex@example.com');

  // Notification Preferences (lazy initialized from localStorage)
  const [dailyReminder, setDailyReminder] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('standlens_dailyReminder');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const [digestNotification, setDigestNotification] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('standlens_digestNotification');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const [joinRequestsNotification, setJoinRequestsNotification] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('standlens_joinRequestsNotification');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const activeUserId = session?.user?.id || 'demo-user-alex';
  const [saving, setSaving] = useState(false);

  // Confirm Modal states
  const [showProfileConfirm, setShowProfileConfirm] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    key: 'daily' | 'digest' | 'join';
    title: string;
    description: string;
    nextValue: boolean;
  } | null>(null);

  // Save Profile Handler (Updates PostgreSQL via NestJS API)
  const executeSaveProfile = async () => {
    try {
      setSaving(true);
      const updatedUser = await apiClient.updateProfile(activeUserId, { name });
      toast.success('Profile updated in database!', `Saved display name "${updatedUser.name}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      toast.error('Failed to update profile', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowProfileConfirm(true);
  };

  // Toggle Confirm Action
  const executeToggleConfirm = () => {
    if (!pendingToggle) return;
    const { key, nextValue } = pendingToggle;

    if (key === 'daily') {
      setDailyReminder(nextValue);
      localStorage.setItem('standlens_dailyReminder', String(nextValue));
      toast.info(nextValue ? 'Daily reminder enabled at 9:00 AM' : 'Daily reminder disabled');
    } else if (key === 'digest') {
      setDigestNotification(nextValue);
      localStorage.setItem('standlens_digestNotification', String(nextValue));
      toast.info(nextValue ? 'Digest ready notifications enabled' : 'Digest notifications disabled');
    } else if (key === 'join') {
      setJoinRequestsNotification(nextValue);
      localStorage.setItem('standlens_joinRequestsNotification', String(nextValue));
      toast.info(nextValue ? 'Join request alerts enabled' : 'Join request alerts disabled');
    }

    setPendingToggle(null);
  };

  return (
    <div className="flex min-h-screen bg-[#0B0B0F] text-[#F0ECE5]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header title="Settings" backUrl="/dashboard" backLabel="Dashboard" />

        <main className="p-8 space-y-8 max-w-4xl w-full mx-auto">
          {isPending ? (
            <div className="flex items-center justify-center py-20 text-[#E5A320] gap-2">
              <Loader2 className="w-6 h-6 animate-spin" /> Loading settings...
            </div>
          ) : (
            <>
              {/* Profile Section */}
              <form onSubmit={handleSaveFormSubmit} className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#E5A320]/10 text-[#E5A320]">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#F0ECE5]">Profile Details</h3>
                    <p className="text-xs text-[#9B9BA3] mt-0.5">Manage your personal account details</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl px-4 py-3 text-sm text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      disabled
                      value={email}
                      className="w-full bg-[#1C1C24]/50 border border-[#23232C] rounded-xl px-4 py-3 text-sm text-[#9B9BA3] cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>

              {/* Notifications Section */}
              <section className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#E5A320]/10 text-[#E5A320]">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#F0ECE5]">Notification Preferences</h3>
                    <p className="text-xs text-[#9B9BA3] mt-0.5">
                      Configure when you receive standup reminders and digest alerts
                    </p>
                  </div>
                </div>

                <div className="space-y-5 divide-y divide-[#23232C]">
                  {/* Setting 1 */}
                  <div className="flex items-center justify-between pt-5 first:pt-0">
                    <div>
                      <p className="text-sm font-semibold text-[#F0ECE5]">Daily Standup Reminder</p>
                      <p className="text-xs text-[#9B9BA3] mt-0.5">Receive a daily prompt at 9:00 AM to submit your update</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingToggle({
                          key: 'daily',
                          title: 'Daily Standup Reminder',
                          description: `Are you sure you want to turn ${!dailyReminder ? 'ON' : 'OFF'} daily standup reminders at 9:00 AM?`,
                          nextValue: !dailyReminder,
                        })
                      }
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                        dailyReminder ? 'bg-[#E5A320]' : 'bg-[#2A2A35]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-[#0B0B0F] block transform transition-transform duration-200 ease-in-out ${
                          dailyReminder ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Setting 2 */}
                  <div className="flex items-center justify-between pt-5">
                    <div>
                      <p className="text-sm font-semibold text-[#F0ECE5]">Digest Ready Notification</p>
                      <p className="text-xs text-[#9B9BA3] mt-0.5">Get notified when AI completes team standup synthesis</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingToggle({
                          key: 'digest',
                          title: 'Digest Ready Notification',
                          description: `Are you sure you want to turn ${!digestNotification ? 'ON' : 'OFF'} notifications when AI digests are ready?`,
                          nextValue: !digestNotification,
                        })
                      }
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                        digestNotification ? 'bg-[#E5A320]' : 'bg-[#2A2A35]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-[#0B0B0F] block transform transition-transform duration-200 ease-in-out ${
                          digestNotification ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Setting 3 */}
                  <div className="flex items-center justify-between pt-5">
                    <div>
                      <p className="text-sm font-semibold text-[#F0ECE5]">New Team Join Requests</p>
                      <p className="text-xs text-[#9B9BA3] mt-0.5">Notify when developers request to join your teams</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingToggle({
                          key: 'join',
                          title: 'Team Join Requests',
                          description: `Are you sure you want to turn ${!joinRequestsNotification ? 'ON' : 'OFF'} notifications for team join requests?`,
                          nextValue: !joinRequestsNotification,
                        })
                      }
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                        joinRequestsNotification ? 'bg-[#E5A320]' : 'bg-[#2A2A35]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-[#0B0B0F] block transform transition-transform duration-200 ease-in-out ${
                          joinRequestsNotification ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      {/* Confirmation Modal for Profile Update */}
      <ConfirmModal
        isOpen={showProfileConfirm}
        title="Update Profile Details?"
        description={`Are you sure you want to update your display name to "${name}"? This name will be visible across all your team standups.`}
        confirmText="Save Changes"
        cancelText="Cancel"
        onClose={() => setShowProfileConfirm(false)}
        onConfirm={executeSaveProfile}
      />

      {/* Confirmation Modal for Toggle Switches */}
      <ConfirmModal
        isOpen={!!pendingToggle}
        title={`Change ${pendingToggle?.title || 'Setting'}?`}
        description={pendingToggle?.description || ''}
        confirmText="Confirm Change"
        cancelText="Cancel"
        onClose={() => setPendingToggle(null)}
        onConfirm={executeToggleConfirm}
      />
    </div>
  );
}
