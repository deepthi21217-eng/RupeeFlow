import { Transaction } from '@/types';
import { useMemo } from 'react';
import { formatINR, formatDate } from '@/utils/format';
import PageHeader from '@/components/PageHeader';
import {
  Plane, Bus, Train, Hotel, ExternalLink, MapPin, TrendingDown, Calendar,
} from 'lucide-react';

interface TravelPageProps {
  transactions: Transaction[];
}

const BOOKING_LINKS = [
  {
    title: 'Bus Booking',
    description: 'Book bus tickets across India with redBus',
    url: 'https://www.redbus.in/',
    icon: Bus,
    color: 'bg-orange-50 text-orange-600',
    provider: 'redBus',
  },
  {
    title: 'Train Booking',
    description: 'Book train tickets through IRCTC',
    url: 'https://www.irctc.co.in/',
    icon: Train,
    color: 'bg-blue-50 text-blue-600',
    provider: 'IRCTC',
  },
  {
    title: 'Hotel Booking',
    description: 'Compare and book hotels with MakeMyTrip',
    url: 'https://www.makemytrip.com/hotels/',
    icon: Hotel,
    color: 'bg-green-50 text-green-600',
    provider: 'MakeMyTrip',
  },
  {
    title: 'Flight Booking',
    description: 'Search and book flights with MakeMyTrip',
    url: 'https://www.makemytrip.com/flights/',
    icon: Plane,
    color: 'bg-purple-50 text-purple-600',
    provider: 'MakeMyTrip',
  },
];

export default function TravelPage({ transactions }: TravelPageProps) {
  const travelTxns = useMemo(() => transactions.filter((t) => t.category === 'Travel'), [transactions]);
  const debitTravelTxns = useMemo(() => travelTxns.filter((t) => t.type === 'debit'), [travelTxns]);
  const totalSpent = useMemo(() => debitTravelTxns.reduce((a, b) => a + b.amount, 0), [debitTravelTxns]);
  const avgSpend = debitTravelTxns.length > 0 ? totalSpent / debitTravelTxns.length : 0;

  return (
    <div>
      <PageHeader title="Travel & Hotel Booking" subtitle="Book travel and view your travel spending analysis" icon={<Plane className="w-5 h-5" />} />

      {/* Travel Spending Summary */}
      {transactions.length > 0 ? (
        travelTxns.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="rf-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Travel Spend</p>
              </div>
              <p className="text-xl font-bold text-slate-800">{formatINR(totalSpent)}</p>
              <p className="text-xs text-slate-400">{debitTravelTxns.length} transactions</p>
            </div>
            <div className="rf-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg per Trip</p>
              </div>
              <p className="text-xl font-bold text-slate-800">{formatINR(avgSpend)}</p>
              <p className="text-xs text-slate-400">Average transaction</p>
            </div>
            <div className="rf-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Travel Txns</p>
              </div>
              <p className="text-xl font-bold text-slate-800">{travelTxns.length}</p>
              <p className="text-xs text-slate-400">{debitTravelTxns.length} debits · {travelTxns.length - debitTravelTxns.length} credits/refunds</p>
            </div>
          </div>
        ) : (
          <div className="rf-card p-6 mb-6 bg-slate-50 border-slate-200">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-600">No travel transactions found in the uploaded statements.</p>
                <p className="text-xs text-slate-400 mt-0.5">Total Travel Spend: {formatINR(0)} · Travel Transactions: 0 · Average: {formatINR(0)}</p>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="rf-card p-6 mb-6 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-3">
            <Plane className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-600">No statement data available.</p>
              <p className="text-xs text-slate-400 mt-0.5">Upload a bank statement to see your travel spending analysis.</p>
            </div>
          </div>
        </div>
      )}

      {/* Booking Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {BOOKING_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <div key={link.title} className="rf-card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${link.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-800">{link.title}</h3>
                  <p className="text-sm text-slate-400 mt-0.5">{link.description}</p>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rf-btn-primary mt-3 inline-flex"
                  >
                    <ExternalLink className="w-4 h-4" /> Book on {link.provider}
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* External Provider Notice */}
      <div className="rf-card p-4 bg-blue-50/40 border-blue-100 mb-6">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-1">About these booking links</p>
            <p className="text-xs">
              These links open the respective booking providers' websites in a new tab. All booking, payment, and transaction
              processes take place on the external provider's website. RupeeFlow does not process bookings, handle payments,
              or store your booking credentials. Please verify all details on the provider's website before making any payment.
            </p>
          </div>
        </div>
      </div>

      {/* Travel Transactions */}
      {travelTxns.length > 0 && (
        <div className="rf-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Your Travel Transactions</h3>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Merchant</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {travelTxns.slice(0, 50).map((t) => (
                  <tr key={t.id} className="hover:bg-blue-50/30">
                    <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-3 py-2 text-slate-700">{t.description}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{t.merchant ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-xs text-slate-700">{formatINR(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
