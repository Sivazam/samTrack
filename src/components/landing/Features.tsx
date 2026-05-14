'use client';

import { FeatureSection } from './FeatureSection';
import { MapPin, WifiOff, Lock } from 'lucide-react';

/* ─── Image Placeholder: Phone Mockup ─── */
function PhoneMockup({
  icon: Icon,
  title,
  subtitle,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  gradient: string;
}) {
  return (
    <div className="relative mx-auto w-[260px] md:w-[300px]">
      {/* Glow effect */}
      <div className={`absolute -inset-4 rounded-[3rem] ${gradient} opacity-20 blur-2xl`} />

      {/* Phone frame */}
      <div className={`relative rounded-[2.5rem] p-[3px] ${gradient} shadow-2xl`}>
        <div className="rounded-[2.35rem] bg-white overflow-hidden">
          {/* Status bar */}
          <div className="h-7 bg-gray-50/80 flex items-center justify-between px-7">
            <span className="text-[10px] font-medium text-gray-400">9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-[14px] h-[10px] bg-gray-300 rounded-[2px]" />
              <div className="w-4 h-[10px] bg-gray-300 rounded-[2px]" />
            </div>
          </div>

          {/* Notch */}
          <div className="mx-auto w-[100px] h-[5px] bg-gray-900 rounded-b-xl -mt-0.5 relative z-10" />

          {/* Content */}
          <div className="h-[420px] md:h-[480px] flex flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-50/50 to-white">
            <div className="w-16 h-16 rounded-2xl bg-[#0d7c3f]/[0.08] flex items-center justify-center mb-5">
              <Icon className="w-8 h-8 text-[#0d7c3f]" />
            </div>
            <p className="text-sm font-bold text-gray-900 text-center">{title}</p>
            <p className="text-[11px] text-gray-400 mt-1.5 text-center">{subtitle}</p>

            {/* Fake UI lines */}
            <div className="mt-8 w-full space-y-3 px-2">
              <div className="h-[10px] bg-gray-100 rounded-full w-full" />
              <div className="h-[10px] bg-gray-100 rounded-full w-[85%]" />
              <div className="h-[10px] bg-gray-100 rounded-full w-[65%]" />
              <div className="mt-5 h-11 bg-[#0d7c3f]/[0.08] rounded-xl w-full flex items-center justify-center">
                <span className="text-[11px] font-semibold text-[#0d7c3f]">
                  Your screenshot goes here
                </span>
              </div>
              <div className="h-[10px] bg-gray-100 rounded-full w-[75%]" />
              <div className="h-[10px] bg-gray-100 rounded-full w-[90%]" />
            </div>
          </div>

          {/* Home indicator */}
          <div className="pb-2 flex justify-center">
            <div className="w-[120px] h-[4px] bg-gray-200 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Image Placeholder: Dashboard Mockup ─── */
function DashboardMockup() {
  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute -inset-4 rounded-3xl bg-[#0d7c3f] opacity-[0.06] blur-2xl" />

      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200/80 bg-white">
        {/* Browser chrome */}
        <div className="h-11 bg-gray-50 border-b border-gray-200/80 flex items-center px-4 gap-2">
          <div className="flex gap-[6px]">
            <div className="w-[12px] h-[12px] rounded-full bg-[#FF5F57]" />
            <div className="w-[12px] h-[12px] rounded-full bg-[#FFBD2E]" />
            <div className="w-[12px] h-[12px] rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 mx-4">
            <div className="h-[26px] bg-white rounded-lg border border-gray-200 flex items-center px-3">
              <div className="w-3 h-3 rounded-full border border-gray-300 mr-2" />
              <span className="text-[11px] text-gray-400 font-medium">
                app.samhitha.com/dashboard
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-5 md:p-7 bg-gradient-to-b from-gray-50/80 to-white min-h-[340px] md:min-h-[400px]">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-[14px] w-[160px] bg-gray-200 rounded-md" />
              <div className="h-[10px] w-[90px] bg-gray-100 rounded-md mt-2" />
            </div>
            <div className="h-8 w-[100px] bg-[#0d7c3f]/[0.08] rounded-lg flex items-center justify-center">
              <span className="text-[9px] font-semibold text-[#0d7c3f]">Today&apos;s View</span>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { val: '847', label: 'Total Leads', color: 'text-[#0d7c3f]' },
              { val: '23', label: "Today's Updates", color: 'text-emerald-600' },
              { val: '156', label: 'Joined', color: 'text-amber-600' },
            ].map((item, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm"
              >
                <div className={`text-[17px] font-bold ${item.color}`}>{item.val}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 font-medium">
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="h-[120px] md:h-[140px] bg-gradient-to-t from-[#0d7c3f]/[0.04] to-transparent rounded-xl border border-[#0d7c3f]/[0.06] flex items-end justify-around px-4 pb-4">
            {[35, 55, 40, 72, 50, 65, 85, 60, 78, 45].map((h, i) => (
              <div
                key={i}
                className="w-[8%] rounded-t-md bg-[#0d7c3f]/20 hover:bg-[#0d7c3f]/40 transition-colors"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>

          {/* Recent leads list */}
          <div className="mt-5 space-y-2">
            {[
              { name: 'Rajesh Kumar', sub: 'Priya', status: 'Joined', statusColor: 'text-emerald-600 bg-emerald-50' },
              { name: 'Sunita Desai', sub: 'Amit', status: 'Follow-up', statusColor: 'text-amber-600 bg-amber-50' },
              { name: 'Vikram Joshi', sub: 'Meera', status: 'Visited', statusColor: 'text-[#0d7c3f] bg-blue-50' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#0d7c3f]/[0.08]" />
                  <span className="text-[11px] font-medium text-gray-600">{item.name} / {item.sub}</span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.statusColor}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Image Placeholder: Security Visual ─── */
function SecurityVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-3xl bg-[#0B1120] opacity-10 blur-2xl" />

      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0B1120] to-[#162040] p-10 md:p-14 shadow-2xl border border-white/[0.04]">
        <div className="relative text-center">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-[#0d7c3f]/20 flex items-center justify-center mb-8">
            <Lock className="w-10 h-10 text-blue-400" />
          </div>
          <h4 className="text-[17px] font-bold text-white mb-2 tracking-tight">
            Enterprise-Grade Security
          </h4>
          <p className="text-[13px] text-gray-400 mb-10">
            Your data is protected at every level
          </p>

          <div className="space-y-2.5">
            {[
              'Data Isolation',
              'Role-Based Access',
              'Encrypted Transfers',
              'Secure Authentication',
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                <span className="text-[13px] text-gray-300 font-medium">{item}</span>
                <span className="ml-auto text-[11px] text-emerald-400 font-semibold tracking-wide">
                  ACTIVE
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── All Feature Sections ─── */
export function Features() {
  return (
    <div id="features">
      {/* Feature 1: Lead Tracking */}
      <FeatureSection
        label="LEAD TRACKING"
        heading="Every lead, tracked"
        subheading="Never lose track of a potential admission"
        description="Every lead your team touches is tracked from first contact to enrollment. PROs log visits with GPS verification, and status updates are captured in real time."
        features={[
          'GPS-verified doorstep and walk-in visits',
          'Real-time status updates with photo proof',
          'All approach types tracked — Phone, Doorstep, Walk-in, Online',
          'Duplicate lead detection prevents double entries',
        ]}
        imageSide="right"
        imageContent={
          <PhoneMockup
            icon={MapPin}
            title="GPS Verified"
            subtitle="Every visit is location-verified"
            gradient="bg-gradient-to-br from-[#0d7c3f] to-[#1a3580]"
          />
        }
      />

      {/* Feature 2: Live Dashboard */}
      <FeatureSection
        label="LIVE DASHBOARD"
        heading="See every lead, as it happens"
        subheading="Real-time visibility into your entire admissions operation"
        description="The moment a PRO updates a lead, it appears on your dashboard. No waiting for end-of-day reports. No phone calls asking 'how many visits today?'"
        features={[
          'Live lead feed — see updates the moment they happen',
          'Daily, weekly, and monthly summaries auto-generated',
          "Track every PRO's performance at a glance",
          'All lead statuses tracked in one unified view',
        ]}
        imageSide="left"
        bgClass="bg-gray-50/50"
        imageContent={<DashboardMockup />}
      />

      {/* Feature 3: Offline Resilience */}
      <FeatureSection
        label="OFFLINE RESILIENCE"
        heading="No signal? No problem."
        subheading="Your PROs never miss a beat"
        description="Students are everywhere — including areas with patchy network. Samhitha works like a native app on any phone, even offline. Status updates sync automatically when connectivity returns."
        features={[
          'Works like a phone app — no app store needed',
          'Log updates even without internet',
          'GPS capture works offline too',
          'Your data is safe even if the phone dies mid-update',
        ]}
        imageSide="right"
        imageContent={
          <PhoneMockup
            icon={WifiOff}
            title="Offline Mode Active"
            subtitle="Updates sync when you're back online"
            gradient="bg-gradient-to-br from-slate-600 to-slate-800"
          />
        }
      />

      {/* Feature 4: Data Security */}
      <FeatureSection
        label="DATA SECURITY"
        heading="Your college data stays private"
        subheading="Built for multi-college environments"
        description="Each college's data is completely isolated. PROs who work with multiple colleges? Each relationship stays private. No one sees what they shouldn't."
        features={[
          'Complete data isolation between college accounts',
          'PROs serve multiple colleges with full privacy',
          'Role-based access — everyone sees only what they need',
          'Bank-grade encryption on every transaction',
        ]}
        imageSide="left"
        bgClass="bg-gray-50/50"
        imageContent={<SecurityVisual />}
      />
    </div>
  );
}
