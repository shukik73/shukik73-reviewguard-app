import React from 'react';
import { Star, MoreHorizontal, RefreshCw, Check, AlertTriangle, MapPin, Edit3 } from 'lucide-react';

export const ReviewInbox: React.FC = () => {
  const REVIEWS = [
    {
      id: 1,
      author: 'Michael Brown',
      stars: 5,
      date: '2 hours ago',
      text: 'Fixed my iPad screen in under an hour. Super professional guys!',
      source: 'Google Maps',
      status: 'pending_approval',
      aiDraft: 'Thank you so much Michael! We\'re glad we could get your iPad screen fixed so quickly at our Downtown TechFix location. Thanks for the 5 stars!',
      keywords: ['iPad screen', 'Downtown TechFix']
    },
    {
      id: 2,
      author: 'Sarah Connor',
      stars: 5,
      date: '5 hours ago',
      text: 'Best repair shop in the city. Prices are very reasonable.',
      source: 'Google Maps',
      status: 'posted',
      aiDraft: 'Thanks Sarah! We aim to provide the best value for phone repairs in the city. Hope to see you again!',
      keywords: ['phone repairs']
    },
    {
      id: 3,
      author: 'Unknown User',
      stars: 2,
      date: '1 day ago',
      text: 'Wait time was longer than expected. Not happy.',
      source: 'Internal Feedback',
      status: 'intercepted',
      aiDraft: null,
      keywords: []
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Review Inbox</h1>
            <p className="text-slate-500">Manage incoming reviews and approve AI responses.</p>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200">
            <button className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-900 rounded-md">All</button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-md">Pending</button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-md">Intercepted</button>
        </div>
      </div>

      <div className="space-y-4">
        {REVIEWS.map((review) => (
          <div key={review.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
            {/* Review Header */}
            <div className="p-5 border-b border-slate-50 flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-start sm:items-center">
               <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${review.stars >= 4 ? 'bg-green-500' : 'bg-orange-500'}`}>
                       {review.author[0]}
                   </div>
                   <div>
                       <h3 className="font-semibold text-slate-900">{review.author}</h3>
                       <div className="flex items-center gap-2">
                           <div className="flex text-yellow-400">
                               {[...Array(5)].map((_, i) => (
                                   <Star key={i} size={14} fill={i < review.stars ? "currentColor" : "none"} className={i < review.stars ? "" : "text-slate-300"} />
                               ))}
                           </div>
                           <span className="text-xs text-slate-400">• {review.date}</span>
                       </div>
                   </div>
               </div>
               <div className="flex items-center gap-3">
                   {review.status === 'posted' && <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">Posted on Google</span>}
                   {review.status === 'intercepted' && <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium flex items-center gap-1"><AlertTriangle size={12}/> Intercepted</span>}
                   {review.status === 'pending_approval' && <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium animate-pulse">AI Draft Ready</span>}
                   <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={20} /></button>
               </div>
            </div>

            {/* Content Body */}
            <div className="p-5 grid lg:grid-cols-2 gap-6">
                {/* Customer Review Text */}
                <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Customer Review</p>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                        "{review.text}"
                    </p>
                </div>

                {/* AI Response Area */}
                {review.status === 'intercepted' ? (
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="text-orange-500 mt-0.5" size={18} />
                        <div>
                            <p className="text-sm font-medium text-orange-800">Negative Feedback Intercepted</p>
                            <p className="text-xs text-orange-600 mt-1">This review was caught by the internal feedback form and <strong>was not</strong> posted to Google Maps. Contact the customer directly to resolve.</p>
                            <button className="mt-3 text-xs bg-white border border-orange-200 text-orange-700 px-3 py-1.5 rounded font-medium hover:bg-orange-50">
                                View Contact Info
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="flex justify-between items-center mb-2">
                             <p className="text-xs font-semibold text-brand-600 uppercase flex items-center gap-1">
                                <span className="animate-pulse">✨</span> AI Drafted Response
                             </p>
                             <div className="flex gap-2">
                                <button className="p-1 text-slate-400 hover:text-brand-600"><RefreshCw size={14}/></button>
                                <button className="p-1 text-slate-400 hover:text-brand-600"><Edit3 size={14}/></button>
                             </div>
                        </div>
                        
                        <div className="bg-brand-50/50 border border-brand-100 rounded-lg p-3 relative">
                            <p className="text-slate-800 text-sm leading-relaxed">
                                {review.aiDraft}
                            </p>
                            {review.keywords.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {review.keywords.map((kw, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-brand-200 text-[10px] text-brand-600 font-medium">
                                            <MapPin size={10} /> {kw}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {review.status === 'pending_approval' && (
                             <div className="mt-3 flex gap-3">
                                 <button className="flex-1 bg-brand-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-brand-700 transition-colors flex items-center justify-center gap-2">
                                     <Check size={16} /> Approve & Post
                                 </button>
                             </div>
                        )}
                    </div>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};