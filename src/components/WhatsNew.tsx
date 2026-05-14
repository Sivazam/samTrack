'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, MapPin, Bell, Shield, CreditCard, Smartphone, BarChart3, Megaphone, Truck, Handshake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Lang = 'te' | 'en';

interface FeatureUpdate {
  id: string;
  date: string;
  title: Record<Lang, string>;
  summary: Record<Lang, string>;
  highlights: Record<Lang, string[]>;
  icon: React.ReactNode;
  tag: 'feature' | 'improvement' | 'security';
  image?: string;
}

const tagLabels: Record<string, Record<Lang, string>> = {
  feature: { en: 'feature', te: 'కొత్తది' },
  improvement: { en: 'improvement', te: 'మెరుగు' },
  security: { en: 'security', te: 'భద్రత' },
};

const tagColors: Record<string, string> = {
  feature: 'bg-purple-100 text-purple-700 border-purple-200',
  improvement: 'bg-blue-100 text-blue-700 border-blue-200',
  security: 'bg-red-100 text-red-700 border-red-200',
};

const WHATS_NEW_VERSION_KEY = 'samhitha_whats_new_seen';
const WHATS_NEW_LANG_KEY = 'samhitha_whats_new_lang';

// Consolidated feature updates — append new entrries at the top
const updates: FeatureUpdate[] = [
  {
    id: '2026-line-worker-delivery-controls',
    date: '04 May 2026',
    title: { en: 'Smarter Delivery Controls', te: 'డెలివరీలపై మరింత నియంత్రణ' },
    summary: {
      en: 'Wholesaler admins can now enable delivery creation for line workers, track exactly who created each parcel, and permanently remove mistaken deliveries when needed.',
      te: 'హోల్‌సేలర్ అడ్మిన్ ఇప్పుడు లైన్ వర్కర్‌లకు డెలివరీ సృష్టించే హక్కు ఇవ్వగలరు, ప్రతి పార్సెల్‌ను ఎవరు సృష్టించారో చూడగలరు, అవసరమైతే పొరపాటున సృష్టించిన డెలివరీలను శాశ్వతంగా తొలగించగలరు.',
    },
    highlights: {
      en: [
        'New setting in wholesaler profile: allow or block delivery creation for line workers',
        'Line workers can create deliveries using the same wholesaler contacts address book',
        'Each delivery now shows creator details and a full activity timeline',
        'Wholesaler admins can permanently delete mistaken deliveries from the details view',
      ],
      te: [
        'హోల్‌సేలర్ ప్రొఫైల్‌లో కొత్త సెట్టింగ్: లైన్ వర్కర్‌లకు డెలివరీ సృష్టించే అనుమతి ఇవ్వండి లేదా ఆపండి',
        'లైన్ వర్కర్‌లు అదే హోల్‌సేలర్ కాంటాక్ట్స్ అడ్రస్ బుక్‌ను ఉపయోగించి డెలివరీలు సృష్టించగలరు',
        'ప్రతి డెలివరీలో ఇప్పుడు సృష్టించిన వ్యక్తి వివరాలు మరియు పూర్తి యాక్టివిటీ టైమ్‌లైన్ కనిపిస్తాయి',
        'పొరపాటున సృష్టించిన డెలివరీలను హోల్‌సేలర్ అడ్మిన్ డిటైల్స్ వ్యూ నుంచే శాశ్వతంగా తొలగించగలరు',
      ],
    },
    icon: <Truck className="w-4 h-4" />,
    tag: 'improvement',
  },
  {
    id: '2026-external-carrier-handoff',
    date: '1 May 2026',
    title: { en: 'Hand Over to Another Wholesaler', te: 'మరొక హోల్‌సేలర్‌కి హ్యాండ్ ఓవర్' },
    summary: {
      en: 'Line workers busy or unavailable? Hand the parcel to another wholesaler (off-platform carrier) and track it from creation to delivery in your dashboard.',
      te: 'లైన్ వర్కర్‌లు బిజీగా ఉన్నారా? పార్సెల్‌ను మరొక హోల్‌సేలర్ (ప్లాట్‌ఫారమ్‌లో లేని కేరియర్)కు హ్యాండ్ ఓవర్ చేసి, దానిని సృష్టి నుండి డెలివరీ వరకు మీ డ్యాష్‌బోర్డ్‌లో ట్రాక్ చేయండి.',
    },
    highlights: {
      en: [
        'In "New Delivery", pick "Hand to Carrier" — choose any contact from your wholesaler address book',
        'New "Handed Over" status — distinct from your line-worker pipeline',
        'Mark Delivered or Failed manually once the carrier confirms the outcome',
        'Reports and exports include external-carrier handoffs alongside regular deliveries',
      ],
      te: [
        '"కొత్త డెలివరీ"లో, "హ్యాండ్ టు కేరియర్" ఎంచుకోండి — మీ హోల్‌సేలర్ అడ్రస్ బుక్ నుండి ఎవరినైనా ఎంచుకోండి',
        'కొత్త "హ్యాండెడ్ ఓవర్" స్టేటస్ — మీ లైన్ వర్కర్ పైప్‌లైన్ నుండి వేరుగా',
        'కేరియర్ ఫలితాన్ని నిర్ధారించిన తర్వాత మాన్యువల్‌గా డెలివర్డ్ లేదా ఫెయిల్డ్ గా మార్క్ చేయండి',
        'రిపోర్ట్‌లు మరియు ఎక్స్‌పోర్ట్‌లలో సాధారణ డెలివరీలతో పాటు బాహ్య కేరియర్ హ్యాండ్‌ఆఫ్‌లు చేర్చబడతాయి',
      ],
    },
    icon: <Handshake className="w-4 h-4" />,
    tag: 'feature',
  },
  {
    id: '2026-cross-wholesaler-delivery',
    date: '01 May 2026',
    title: { en: 'Cross-Wholesaler Deliveries', te: 'క్రాస్-హోల్‌సేలర్ డెలివరీలు' },
    summary: {
      en: 'Create parcels on behalf of yourself, your contacts, or partner wholesalers — and assign them to your line workers for delivery to retailers.',
      te: 'మీ స్వంత, మీ కాంటాక్ట్‌ల, లేదా భాగస్వామ్య హోల్‌సేలర్‌ల తరఫున పార్సెల్‌లను సృష్టించండి — మరియు రిటైలర్‌లకు డెలివరీ కోసం మీ లైన్ వర్కర్‌లకు అసైన్ చేయండి.',
    },
    highlights: {
      en: [
        'New "Deliveries" tab — create parcels with photos, invoice numbers and notes',
        'Assign to a specific line worker, or open it to any worker in an area',
        'Auto-generated parcel codes (DLV-YYYY-NNNN) for easy tracking',
        'Line workers see new deliveries instantly with a popup, accept and mark Delivered/Failed on the go',
        'Wholesaler gets a real-time notification on every status change',
        'Manage your network of partner wholesalers from one place',
      ],
      te: [
        'కొత్త "డెలివరీలు" ట్యాబ్ — ఫోటోలు, ఇన్‌వాయిస్ నంబర్‌లు మరియు నోట్స్‌తో పార్సెల్‌లను సృష్టించండి',
        'నిర్దిష్ట లైన్ వర్కర్‌కి అసైన్ చేయండి, లేదా ఏరియాలోని ఎవరికైనా ఓపెన్ చేయండి',
        'సులువైన ట్రాకింగ్ కోసం ఆటో-జనరేటెడ్ పార్సెల్ కోడ్‌లు (DLV-YYYY-NNNN)',
        'లైన్ వర్కర్‌లు పాపప్ ద్వారా తక్షణం కొత్త డెలివరీలను చూస్తారు, యాక్సెప్ట్ చేసి డెలివర్డ్/ఫెయిల్డ్ గా మార్క్ చేస్తారు',
        'ప్రతి స్టేటస్ మార్పుపై హోల్‌సేలర్‌కు తక్షణ నోటిఫికేషన్',
        'మీ భాగస్వామ్య హోల్‌సేలర్‌ల నెట్‌వర్క్‌ను ఒకే చోట నిర్వహించండి',
      ],
    },
    icon: <Truck className="w-4 h-4" />,
    tag: 'feature',
  },
  {
    id: '2025-06-14-no-payment-visits',
    date: '14 Jun 2025',
    title: { en: 'No-Payment Visits', te: 'పేమెంట్ లేని విజిట్‌లు' },
    summary: {
      en: 'Now you can record visits to retailers even when no payment was collected — and see them across all your reports.',
      te: 'పేమెంట్ వసూలు చేయనప్పటికీ రిటైలర్ విజిట్‌లను రికార్డ్ చేయవచ్చు — మీ అన్ని రిపోర్ట్‌లలో చూడవచ్చు.',
    },
    highlights: {
      en: [
        'Pick a reason for each visit: Shop Closed, No Money, Credit Limit, Owner Absent, or Other',
        'See all no-payment visits in Payments, Transactions, Red Flags, Areas, and DaySheet tabs',
        'Choose to include or exclude these visits when downloading any report',
        'Check which retailers haven\'t been visited yet — shown under each area',
      ],
      te: [
        'ప్రతి విజిట్‌కు కారణం ఎంచుకోండి: షాప్ మూసివేసింది, డబ్బు లేదు, క్రెడిట్ లిమిట్, యజమాని లేరు, ఇతరం',
        'పేమెంట్స్, ట్రాన్సాక్షన్స్, రెడ్ ఫ్లాగ్స్, ఏరియాలు, డేషీట్ ట్యాబ్‌లలో అన్ని విజిట్‌లను చూడండి',
        'రిపోర్ట్ డౌన్‌లోడ్ చేసేటప్పుడు ఈ విజిట్‌లను చేర్చాలా వద్దా ఎంచుకోండి',
        'ఏ రిటైలర్‌లను ఇంకా సందర్శించలేదో చూడండి — ప్రతి ఏరియా కింద చూపబడుతుంది',
      ],
    },
    icon: <MapPin className="w-4 h-4" />,
    tag: 'feature',
  },
  {
    id: '2025-06-14-activity-overview',
    date: '14 Apr 2026',
    title: { en: 'Activity Overview', te: 'యాక్టివిటీ ఓవర్‌వ్యూ' },
    summary: {
      en: 'Your dashboard now shows total payments and total no-payment visits side by side so you can see everything at a glance.',
      te: 'మీ డ్యాష్‌బోర్డ్‌లో మొత్తం పేమెంట్‌లు మరియు మొత్తం నో-పేమెంట్ విజిట్‌లు పక్కపక్కనే కనిపిస్తాయి.',
    },
    highlights: {
      en: [
        'Payments count in purple, no-payment visits count in orange — easy to compare',
        'Loads faster with behind-the-scenes counting',
      ],
      te: [
        'పేమెంట్‌ల సంఖ్య ఊదా రంగులో, నో-పేమెంట్ విజిట్‌ల సంఖ్య నారింజ రంగులో — సులభంగా పోల్చవచ్చు',
        'వెనుక వైపు లెక్కింపు ద్వారా వేగంగా లోడ్ అవుతుంది',
      ],
    },
    icon: <BarChart3 className="w-4 h-4" />,
    tag: 'improvement',
  },
  {
    id: '2025-06-10-notifications',
    date: '10 Mar 2026',
    title: { en: 'Instant Notifications & SMS', te: 'తక్షణ నోటిఫికేషన్‌లు & SMS' },
    summary: {
      en: 'Get notified the moment a payment is made or a visit is recorded — on your phone and via text message.',
      te: 'పేమెంట్ చేసినప్పుడు లేదా విజిట్ రికార్డ్ అయినప్పుడు వెంటనే మీ ఫోన్‌లో మరియు SMS ద్వారా తెలుసుకోండి.',
    },
    highlights: {
      en: [
        'Instant push notifications on all your devices',
        'SMS alerts sent to wholesalers when payments come in',
        'Fully compliant with telecom regulations',
        'Bell icon in the top bar shows how many unread notifications you have',
      ],
      te: [
        'మీ అన్ని పరికరాలలో తక్షణ నోటిఫికేషన్‌లు',
        'పేమెంట్‌లు వచ్చినప్పుడు హోల్‌సేలర్‌లకు SMS అలర్ట్‌లు',
        'టెలికాం నిబంధనలకు పూర్తిగా అనుగుణంగా ఉంటుంది',
        'టాప్ బార్‌లో బెల్ ఐకాన్ చదవని నోటిఫికేషన్‌ల సంఖ్యను చూపిస్తుంది',
      ],
    },
    icon: <Bell className="w-4 h-4" />,
    tag: 'feature',
  },
  {
    id: '2025-06-09-payment-verification',
    date: '09 Feb 2026',
    title: { en: 'Payment Verification & Color Tags', te: 'పేమెంట్ వెరిఫికేషన్ & కలర్ ట్యాగ్‌లు' },
    summary: {
      en: 'Wholesalers can now approve or reject each payment, and every payment method has its own color for quick spotting.',
      te: 'హోల్‌సేలర్‌లు ఇప్పుడు ప్రతి పేమెంట్‌ను ఆమోదించవచ్చు లేదా తిరస్కరించవచ్చు, ప్రతి పేమెంట్ విధానానికి వేరే రంగు ఉంటుంది.',
    },
    highlights: {
      en: [
        'Approve or reject payments collected by your line workers with one tap',
        'Color-coded payment types: Cash (green), UPI (blue), Cheque (amber), Others (gray)',
        'Full history of who approved or rejected, and when',
      ],
      te: [
        'మీ లైన్ వర్కర్‌లు వసూలు చేసిన పేమెంట్‌లను ఒక్క టచ్‌తో ఆమోదించండి లేదా తిరస్కరించండి',
        'రంగుల వారీగా పేమెంట్ రకాలు: క్యాష్ (ఆకుపచ్చ), UPI (నీలం), చెక్ (పసుపు), ఇతరాలు (గ్రే)',
        'ఎవరు ఆమోదించారు లేదా తిరస్కరించారు, ఎప్పుడు — పూర్తి హిస్టరీ',
      ],
    },
    icon: <CreditCard className="w-4 h-4" />,
    tag: 'feature',
  },
  {
    id: '2025-06-07-security-upgrade',
    date: '07 Jan 2026',
    title: { en: 'Stronger Data Protection', te: 'మెరుగైన డేటా భద్రత' },
    summary: {
      en: 'Your data is now even more secure — only the right people can see and change the right information.',
      te: 'మీ డేటా ఇప్పుడు మరింత సురక్షితం — సరైన వ్యక్తులు మాత్రమే సరైన సమాచారాన్ని చూడగలరు మరియు మార్చగలరు.',
    },
    highlights: {
      en: [
        'Each user only sees what they\'re allowed to based on their role',
        'Your business data is completely separate from other businesses',
        'All changes are double-checked on the server to prevent errors',
      ],
      te: [
        'ప్రతి యూజర్ వారి రోల్ ప్రకారం అనుమతించిన సమాచారాన్ని మాత్రమే చూస్తారు',
        'మీ వ్యాపార డేటా ఇతర వ్యాపారాల నుండి పూర్తిగా వేరుగా ఉంటుంది',
        'తప్పులు జరగకుండా అన్ని మార్పులు సర్వర్‌లో రెండుసార్లు తనిఖీ చేయబడతాయి',
      ],
    },
    icon: <Shield className="w-4 h-4" />,
    tag: 'security',
  },
  {
    id: '2025-06-06-install-app',
    date: '06 Dec 2025',
    title: { en: 'Install & Use Offline', te: 'ఇన్‌స్టాల్ చేసి ఆఫ్‌లైన్‌లో వాడండి' },
    summary: {
      en: 'Add Samhitha to your home screen and keep using it even when your internet is slow or unavailable.',
      te: 'Samhitha ను మీ హోమ్ స్క్రీన్‌కి జోడించండి — ఇంటర్నెట్ నెమ్మదిగా ఉన్నా లేదా లేకపోయినా వాడవచ్చు.',
    },
    highlights: {
      en: [
        'Works even with a weak or no internet connection',
        'Opens instantly — just like any other app on your phone',
        'Updates automatically in the background when you\'re back online',
      ],
      te: [
        'బలహీనమైన లేదా ఇంటర్నెట్ కనెక్షన్ లేకుండా కూడా పని చేస్తుంది',
        'మీ ఫోన్‌లోని ఏ ఇతర యాప్ లాగానే వెంటనే తెరుచుకుంటుంది',
        'మీరు ఆన్‌లైన్‌కి తిరిగి వచ్చినప్పుడు బ్యాక్‌గ్రౌండ్‌లో ఆటోమేటిక్‌గా అప్‌డేట్ అవుతుంది',
      ],
    },
    icon: <Smartphone className="w-4 h-4" />,
    tag: 'feature',
  },
];

const CURRENT_VERSION = updates[0]?.id ?? '';

export function WhatsNewFAB() {
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(WHATS_NEW_LANG_KEY) as Lang) || 'te';
    }
    return 'te';
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seen = localStorage.getItem(WHATS_NEW_VERSION_KEY);
    if (seen !== CURRENT_VERSION) {
      setHasNew(true);
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setHasNew(false);
    localStorage.setItem(WHATS_NEW_VERSION_KEY, CURRENT_VERSION);
  };

  const handleClose = () => setOpen(false);

  const toggleLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem(WHATS_NEW_LANG_KEY, l);
  };

  return (
    <>
      {/* Floating Action Button — bottom-20 on mobile to clear bottom nav, bottom-6 on desktop */}
      <motion.button
        onClick={handleOpen}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-shadow"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="What's New"
        aria-label="What's New"
      >
        <Megaphone className="w-5 h-5 lg:w-6 lg:h-6" />
        {hasNew && (
          <motion.span
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            !
          </motion.span>
        )}
      </motion.button>

      {/* Sliding Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/30 z-[60]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
            />

            {/* Panel — drag={false} prevents framer-motion from stealing touch scroll */}
            <motion.div
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-900 z-[60] shadow-2xl flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              drag={false}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">
                    {lang === 'te' ? 'కొత్త అప్‌డేట్‌లు' : "What's New"}
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-full hover:bg-white/20 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Language Toggle */}
              <div className="flex items-center justify-center gap-1 px-4 py-2 border-b bg-gray-50 dark:bg-gray-800 shrink-0">
                <button
                  onClick={() => toggleLang('te')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    lang === 'te'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  తెలుగు
                </button>
                <button
                  onClick={() => toggleLang('en')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    lang === 'en'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  English
                </button>
              </div>

              {/* Scrollable area — plain div with inline styles to force touch scroll on all browsers */}
              <div
                ref={scrollRef}
                className="flex-1 min-h-0"
                style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain' }}
              >
                <div className="p-4 space-y-4">
                  {updates.map((update, index) => (
                    <motion.div
                      key={update.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                      className="rounded-xl border bg-gray-50 dark:bg-gray-800 hover:border-purple-300 transition-colors overflow-hidden"
                    >
                      {/* Image or gradient placeholder */}
                      {update.image ? (
                        <div className="w-full h-40 bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <img
                            src={update.image}
                            alt={update.title[lang]}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-28 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 flex items-center justify-center">
                          <div className="p-3 rounded-full bg-white/80 dark:bg-gray-800/80 text-purple-500">
                            {update.icon}
                          </div>
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h3 className="font-semibold text-sm">{update.title[lang]}</h3>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${tagColors[update.tag]}`}
                          >
                            {tagLabels[update.tag][lang]}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                          {update.summary[lang]}
                        </p>

                        <ul className="space-y-1">
                          {update.highlights[lang].map((h, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                              <span className="text-purple-500 mt-0.5 shrink-0">•</span>
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>

                        <span className="text-[10px] text-muted-foreground/60 mt-2 block">
                          {update.date}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t text-center shrink-0">
                <p className="text-xs text-muted-foreground">
                  Samhitha v1 &middot; {updates.length} {lang === 'te' ? 'అప్‌డేట్‌లు' : 'updates'}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
