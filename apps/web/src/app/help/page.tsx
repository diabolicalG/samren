import { HelpCircle, Globe, Database, Tv, Download, Settings } from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  {
    q: 'What is Samren?',
    a:
      'Samren is an anime streaming marketplace that aggregates anime data from the Jikan API and provides video stream links via WCOStream scraping.',
  },
  {
    q: 'What data sources does Samren use?',
    a:
      'Jikan API provides anime metadata, episode lists, schedules, and top anime lists. WCOStream provides video stream embed URLs via the ShivraAPI scraper.',
  },
  {
    q: 'Can I host my own instance?',
    a:
      'Yes. See the Setup Guide. You need Node.js, Python 3.12, PostgreSQL, and Redis. The easiest way is via Docker.',
  },
  {
    q: 'How does caching work?',
    a:
      'The backend API gateway caches ShivraAPI responses in Redis. Stream URLs are cached for 1 hour; general API responses for 5 minutes.',
  },
  {
    q: 'What player options are available?',
    a:
      'MPV (external player), Browser (HTML5 video), and Auto (selects automatically based on device).',
  },
];

const features = [
  { icon: Globe, label: 'Aggregated anime data from Jikan' },
  { icon: Database, label: 'Redis caching for fast responses' },
  { icon: Tv, label: 'Browser and MPV player support' },
  { icon: Download, label: 'Episode download manager' },
  { icon: Settings, label: 'Customizable settings' },
];

export default function HelpPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <HelpCircle size={32} className="text-blue-500" />
        <h1 className="text-2xl font-bold">Help & FAQ</h1>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Features</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {features.map((f) => (
            <div key={f.label} className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
              <f.icon size={18} className="text-blue-400" />
              <span className="text-sm text-gray-300">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-gray-900 rounded-lg p-4">
              <h3 className="font-medium text-white mb-1">{faq.q}</h3>
              <p className="text-sm text-gray-400">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
