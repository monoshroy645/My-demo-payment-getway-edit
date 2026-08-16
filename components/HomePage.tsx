import React, { useState, useEffect, useRef } from 'react';

interface HomePageProps {
  onStartBkash: () => void;
  onStartNagad: () => void;
  onLoanApplyIntent?: () => void;
  nagadEnabled?: boolean;
  bkashEnabled?: boolean;
}

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
};

const HomePage: React.FC<HomePageProps> = ({ onStartBkash, onStartNagad, onLoanApplyIntent, nagadEnabled = true, bkashEnabled = true }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [highlightPayment, setHighlightPayment] = useState(false);
  const paymentButtonsRef = useRef<HTMLDivElement>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const [notifDismissed, setNotifDismissed] = useState(false);

  const scrollToPayment = () => {
    try { onLoanApplyIntent && onLoanApplyIntent(); } catch (e) {}
    if (paymentButtonsRef.current) {
      paymentButtonsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightPayment(false);
      setTimeout(() => setHighlightPayment(true), 600);
      setTimeout(() => setHighlightPayment(false), 3000);
    }
  };

  const slides = [
    {
      url: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=1600&h=600',
      title: '\u0986\u09aa\u09a8\u09be\u09b0 \u09b8\u09cd\u09ac\u09aa\u09cd\u09a8 \u09aa\u09c2\u09b0\u09a3\u09c7 \u0986\u09ae\u09b0\u09be',
      desc: '\u09e7 \u09b2\u0995\u09cd\u09b7 \u099f\u09be\u0995\u09be \u09aa\u09b0\u09cd\u09af\u09a8\u09cd\u09a4 \u09b2\u09cb\u09a8 \u09a8\u09bf\u09a8 \u098f\u09ac\u0982 \u0986\u09aa\u09a8\u09be\u09b0 \u09ac\u09cd\u09af\u09ac\u09b8\u09be\u09b0 \u09aa\u09b0\u09bf\u09a7\u09bf \u09ac\u09c3\u09a6\u09cd\u09a7\u09bf \u0995\u09b0\u09c1\u09a8\u0964',
    },
    {
      url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=1600&h=600',
      title: '\u09a6\u09cd\u09b0\u09c1\u09a4 \u0985\u09a8\u09c1\u09ae\u09cb\u09a6\u09a8 \u0993 \u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f',
      desc: '\u09af\u09be\u099a\u09be\u0987\u0995\u09b0\u09a3 \u09b6\u09c7\u09b7 \u09b9\u0993\u09df\u09be\u09b0 \u0995\u09df\u09c7\u0995 \u09ae\u09bf\u09a8\u09bf\u099f\u09c7\u09b0 \u09ae\u09a7\u09cd\u09af\u09c7\u0987 \u0986\u09aa\u09a8\u09be\u09b0 \u098f\u0995\u09be\u0989\u09a8\u09cd\u099f\u09c7 \u099f\u09be\u0995\u09be \u09aa\u09cc\u0981\u099b\u09c7 \u09af\u09be\u09ac\u09c7\u0964'
    }
  ];

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(existing.toJSON()) });
        return;
      }
      const vapidRes = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await vapidRes.json();
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) });
    } catch (err) {}
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Hero Slider */}
      <div className="relative w-full h-[300px] md:h-[450px] rounded-3xl overflow-hidden shadow-2xl mb-12 group">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent z-10"></div>
            <img
              src={slide.url}
              alt={slide.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 z-20 flex flex-col justify-center px-8 md:px-16">
              <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight drop-shadow-lg">
                {slide.title}
              </h2>
              <p className="text-lg md:text-xl text-gray-100 mb-8 max-w-lg drop-shadow-md font-medium">
                {slide.desc}
              </p>
              <div>
                <button
                  onClick={scrollToPayment}
                  className="bg-[#E2136E] hover:bg-[#D11263] text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105 active:scale-95 inline-flex items-center space-x-2"
                >
                  <span>{'\u0986\u09ac\u09c7\u09a6\u09a8 \u09b6\u09c1\u09b0\u09c1 \u0995\u09b0\u09c1\u09a8'}</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition opacity-0 group-hover:opacity-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition opacity-0 group-hover:opacity-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex space-x-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="text-center mb-12 px-4 flex flex-col items-center">
        {/* Top Application Button */}
        <button
          onClick={scrollToPayment}
          className="bg-[#E2136E] hover:bg-[#D11263] text-white font-bold py-4 px-10 rounded-2xl shadow-xl transform transition hover:scale-105 active:scale-95 text-xl mb-8 flex items-center justify-center space-x-3"
        >
          <span className="flex items-center">{'\u09b2\u09cb\u09a8 \u0986\u09ac\u09c7\u09a6\u09a8 \u0995\u09b0\u09c1\u09a8'}</span>
        </button>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
          {'\u09b8\u09b9\u099c \u09b6\u09b0\u09cd\u09a4\u09c7 \u098f\u09ac\u0982 \u09a6\u09cd\u09b0\u09c1\u09a4 \u09b8\u09ae\u09af\u09bc\u09c7'} <br />
          <span className="text-[#E2136E]">{'\u09aa\u09be\u09b0\u09cd\u09b8\u09cb\u09a8\u09be\u09b2 \u09b2\u09cb\u09a8 \u09aa\u09be\u09a8'}</span>
        </h1>
        <p className="text-md text-gray-600 max-w-2xl mx-auto mb-8">
          {'\u0986\u09ae\u09be\u09a6\u09c7\u09b0 \u09aa\u09cd\u09b2\u09cd\u09af\u09be\u099f\u09ab\u09b0\u09cd\u09ae\u09c7\u09b0 \u09ae\u09be\u09a7\u09cd\u09af\u09ae\u09c7 \u0986\u09aa\u09a8\u09bf \u0998\u09b0\u09c7 \u09ac\u09b8\u09c7\u0987 \u09ac\u09bf\u0995\u09be\u09b6\u09c7\u09b0 \u09b2\u09c7\u09a8\u09a6\u09c7\u09a8\u09c7\u09b0 \u0993\u09aa\u09b0 \u09ad\u09bf\u09a4\u09cd\u09a4\u09bf \u0995\u09b0\u09c7 \u09e7,\u09e6\u09e6,\u09e6\u09e6\u09e6 \u099f\u09be\u0995\u09be \u09aa\u09b0\u09cd\u09af\u09a8\u09cd\u09a4 \u09b2\u09cb\u09a8 \u09aa\u09c7\u09a4\u09c7 \u09aa\u09be\u09b0\u09c7\u09a8\u0964'}
        </p>

        {/* Secondary Application Button */}
        <button
          onClick={scrollToPayment}
          className="bg-gray-100 hover:bg-gray-200 text-[#E2136E] font-bold py-4 px-10 rounded-2xl shadow-md transform transition hover:scale-105 active:scale-95 text-lg flex items-center justify-center mx-auto space-x-3 border border-pink-100"
        >
          <span className="flex items-center">{'\u09b2\u09cb\u09a8 \u0986\u09ac\u09c7\u09a6\u09a8 \u0995\u09b0\u09c1\u09a8'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 px-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center hover:shadow-md transition">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-800 mb-2">{'\u09a6\u09cd\u09b0\u09c1\u09a4 \u09aa\u09cd\u09b0\u09b8\u09c7\u09b8\u09bf\u0982'}</h3>
          <p className="text-sm text-gray-600">{'\u09ae\u09be\u09a4\u09cd\u09b0 \u09eb \u09ae\u09bf\u09a8\u09bf\u099f\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 \u0986\u09ac\u09c7\u09a6\u09a8\u099f\u09bf \u09af\u09be\u099a\u09be\u0987 \u0995\u09b0\u09be \u09b9\u09af\u09bc\u0964'}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center hover:shadow-md transition">
          <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#E2136E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-800 mb-2">{'\u09b8\u09ae\u09cd\u09aa\u09c2\u09b0\u09cd\u09a3 \u09a8\u09bf\u09b0\u09be\u09aa\u09a6'}</h3>
          <p className="text-sm text-gray-600">{'\u0986\u09aa\u09a8\u09be\u09b0 \u09ac\u09cd\u09af\u0995\u09cd\u09a4\u09bf\u0997\u09a4 \u09a4\u09a5\u09cd\u09af\u09c7\u09b0 \u0997\u09cb\u09aa\u09a8\u09c0\u09af\u09bc\u09a4\u09be \u0986\u09ae\u09be\u09a6\u09c7\u09b0 \u09b8\u09b0\u09cd\u09ac\u09cb\u099a\u09cd\u099a \u0985\u0997\u09cd\u09b0\u09be\u09a7\u09bf\u0995\u09be\u09b0\u0964'}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center hover:shadow-md transition">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-800 mb-2">{'\u0995\u09ae \u09b8\u09c1\u09a6'}</h3>
          <p className="text-sm text-gray-600">{'\u09ac\u09be\u099c\u09be\u09b0\u09c7\u09b0 \u09b8\u09ac\u099a\u09c7\u09af\u09bc\u09c7 \u0986\u0995\u09b0\u09cd\u09b7\u09a3\u09c0\u09af\u09bc \u09b8\u09c1\u09a6\u09c7\u09b0 \u09b9\u09be\u09b0\u09c7 \u0988\u09a3 \u09aa\u09cd\u09b0\u09a6\u09be\u09a8 \u0995\u09b0\u09be \u09b9\u09af\u09bc\u0964'}</p>
        </div>
      </div>

      <div className="bg-pink-50 p-8 rounded-3xl border border-pink-100 mx-4 mb-16">
        <h2 className="text-2xl font-bold text-pink-900 mb-6">{'\u09b2\u09cb\u09a8 \u09aa\u09be\u0993\u09af\u09bc\u09be\u09b0 \u09a7\u09be\u09aa\u09b8\u09ae\u09c2\u09b9\u003a'}</h2>
        <ul className="space-y-6 mb-8">
          <li className="flex items-start space-x-4">
            <span className="flex-shrink-0 w-8 h-8 bg-[#E2136E] text-white rounded-full flex items-center justify-center text-lg font-bold mt-1 shadow-md">{'\u09e7'}</span>
            <p className="text-gray-700 text-lg">{'\u0986\u09ac\u09c7\u09a6\u09a8 \u09ab\u09b0\u09ae\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 \u09ac\u09cd\u09af\u0995\u09cd\u09a4\u09bf\u0997\u09a4 \u098f\u09ac\u0982 \u0988\u09a3\u09c7\u09b0 \u09a4\u09a5\u09cd\u09af \u09aa\u09cd\u09b0\u09a6\u09be\u09a8 \u0995\u09b0\u09c1\u09a8\u0964'}</p>
          </li>
          <li className="flex items-start space-x-4">
            <span className="flex-shrink-0 w-8 h-8 bg-[#E2136E] text-white rounded-full flex items-center justify-center text-lg font-bold mt-1 shadow-md">{'\u09e8'}</span>
            <p className="text-gray-700 text-lg">{'\u09ac\u09bf\u0995\u09be\u09b6 \u09a8\u09ae\u09cd\u09ac\u09b0 \u09aa\u09cd\u09b0\u09a6\u09be\u09a8 \u0995\u09b0\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 \u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09b2\u09c7\u09a8\u09a6\u09c7\u09a8 \u09aa\u09cd\u09b0\u09cb\u09ab\u09be\u0987\u09b2 \u09af\u09be\u099a\u09be\u0987 \u0995\u09b0\u09c1\u09a8\u0964'}</p>
          </li>
          <li className="flex items-start space-x-4">
            <span className="flex-shrink-0 w-8 h-8 bg-[#E2136E] text-white rounded-full flex items-center justify-center text-lg font-bold mt-1 shadow-md">{'\u09e9'}</span>
            <p className="text-gray-700 text-lg">{'\u09af\u09be\u099a\u09be\u0987 \u09b6\u09c7\u09b7\u09c7 \u0985\u09a8\u09c1\u09ae\u09cb\u09a6\u09a8 \u09aa\u09c7\u09b2\u09c7 \u09b8\u09cd\u09ac\u09b2\u09cd\u09aa \u09aa\u09cd\u09b2\u09cd\u09af\u09be\u099f\u09ab\u09b0\u09cd\u09ae \u09ab\u09bf \u09aa\u09cd\u09b0\u09a6\u09be\u09a8 \u0995\u09b0\u09c7 \u09b2\u09cb\u09a8 \u0997\u09cd\u09b0\u09b9\u09a3 \u0995\u09b0\u09c1\u09a8\u0964'}</p>
          </li>
        </ul>

        <div ref={paymentButtonsRef} className="space-y-4 border-t border-pink-100 pt-8 scroll-mt-24">
          {!bkashEnabled && !nagadEnabled ? (
            <div className="p-6 text-center bg-white rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-gray-600 font-bold">পেমেন্ট সেবা সাময়িকভাবে বন্ধ আছে</p>
              <p className="text-xs text-gray-400 mt-1">অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন</p>
            </div>
          ) : (
            <>
              {bkashEnabled && (
                <button
                  onClick={onStartBkash}
                  className={`w-full flex items-center justify-center space-x-3 bg-[#E2136E] hover:bg-[#D11263] text-white font-bold py-4 rounded-2xl shadow-lg transform transition hover:scale-105 active:scale-95 cursor-pointer${highlightPayment ? ' animate-indicator' : ''}`}
                >
                  <span className="text-xl">বিকাশ দিয়ে আবেদন</span>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                  </svg>
                </button>
              )}

              {nagadEnabled && (
                <button
                  onClick={onStartNagad}
                  className={`w-full flex items-center justify-center space-x-3 bg-[#F58220] hover:bg-[#e07318] text-white font-bold py-4 rounded-2xl shadow-lg transform transition hover:scale-105 active:scale-95 cursor-pointer${highlightPayment ? ' animate-indicator' : ''}`}
                >
                  <span className="text-xl">নগদ দিয়ে আবেদন</span>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
