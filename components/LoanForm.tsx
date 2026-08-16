
import React, { useState, useEffect, useRef } from 'react';
import { LoanFormData } from '../types';

interface LoanFormProps {
  onSubmit: (data: LoanFormData) => void;
  initialData: LoanFormData;
  loginPhone: string;
}

const LoanForm: React.FC<LoanFormProps> = ({ onSubmit, initialData, loginPhone }) => {
  const [formData, setFormData] = useState<LoanFormData>({
    ...initialData,
    paymentNumber: loginPhone
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoanFormData, string>>>({});
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showMinLoanError, setShowMinLoanError] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);
  const loanAmountRef = useRef<HTMLDivElement>(null);

  const bannerSlides = [
    'https://i.postimg.cc/fb69qZfp/1770223324535.png',
    'https://i.postimg.cc/7hrShDCT/1770223319522.png'
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerSlides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [bannerSlides.length]);

  const validate = () => {
    const newErrors: Partial<Record<keyof LoanFormData, string>> = {};
    if (!formData.fullName) newErrors.fullName = 'নাম আবশ্যক';
    if (!formData.loanAmount || parseInt(formData.loanAmount) < 5000) {
      if (formData.loanAmount && parseInt(formData.loanAmount) < 5000) {
        setShowMinLoanError(true);
        setTimeout(() => {
          loanAmountRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        return false;
      }
      newErrors.loanAmount = 'লোনের পরিমাণ আবশ্যক';
    }
    if (!formData.duration) newErrors.duration = 'মেয়াদ নির্বাচন করুন';
    if (!formData.address) newErrors.address = 'ঠিকানা আবশ্যক';
    if (!formData.nidNumber) newErrors.nidNumber = 'এনাইডি নম্বর আবশ্যক';
    if (!formData.paymentNumber || formData.paymentNumber.length < 11) newErrors.paymentNumber = 'সঠিক মোবাইল নম্বর দিন';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setBtnLoading(true);
      setTimeout(() => {
        setBtnLoading(false);
        onSubmit(formData);
      }, 1000);
    }
  };

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <div className="relative w-full h-40 md:h-48 rounded-2xl overflow-hidden shadow-lg border border-gray-100 mb-8 bg-gray-100">
        {bannerSlides.map((url, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img 
              src={url} 
              alt={`Banner ${index + 1}`} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/5"></div>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">আবেদন ফরম পূরণ করুন</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">আপনার পূর্ণ নাম</label>
            <input
              type="text"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#E2136E] outline-none ${errors.fullName ? 'border-red-500' : 'border-gray-200'}`}
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="যেমন: মোঃ করিম হোসেন"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">জাতীয় পরিচয় পত্র নম্বর (NID)</label>
            <input
              type="text"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#E2136E] outline-none ${errors.nidNumber ? 'border-red-500' : 'border-gray-200'}`}
              value={formData.nidNumber}
              onChange={(e) => setFormData({ ...formData, nidNumber: e.target.value })}
              placeholder="১০ বা ১৭ ডিজিটের এনাইডি নম্বর দিন"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div ref={loanAmountRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">লোনের পরিমাণ (টাকা)</label>
              <input
                type="number"
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#E2136E] outline-none ${errors.loanAmount || showMinLoanError ? 'border-red-500' : 'border-gray-200'}`}
                value={formData.loanAmount}
                onChange={(e) => { setFormData({ ...formData, loanAmount: e.target.value }); setShowMinLoanError(false); }}
                placeholder="যেমন: ৫০,০০০"
              />
              {showMinLoanError && (
                <p className="text-sm text-[#E2136E] font-bold mt-2">সর্বনিম্ন লোন পরিমাণ ৳৫,০০০ (টাকা)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">লোনের মেয়াদ</label>
              <select
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#E2136E] outline-none ${errors.duration ? 'border-red-500' : 'border-gray-200'}`}
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              >
                <option value="">নির্বাচন করুন</option>
                <option value="৬ মাস">৬ মাস</option>
                <option value="১২ মাস">১২ মাস</option>
                <option value="২৪ মাস">২৪ মাস</option>
                <option value="৩৬ মাস">৩৬ মাস</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">স্থায়ী ঠিকানা</label>
            <textarea
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#E2136E] outline-none h-24 ${errors.address ? 'border-red-500' : 'border-gray-200'}`}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="আপনার পূর্ণ ঠিকানা লিখুন"
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-xl">
            <label className="block text-sm font-medium text-[#E2136E] mb-1">বিকাশ নম্বর</label>
            <input
              type="tel"
              readOnly
              className="w-full p-3 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 font-bold cursor-not-allowed"
              value={formData.paymentNumber}
              maxLength={11}
            />
          </div>

          <button
            type="submit"
            disabled={btnLoading}
            className="w-full bg-[#E2136E] hover:bg-[#D11263] text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95"
          >
            {btnLoading ? (
              <div className="flex gap-1.5 justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            ) : 'পরবর্তী ধাপে যান'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoanForm;
