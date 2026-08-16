
import React from 'react';

interface HeaderProps {
  provider?: 'bkash' | 'nagad' | null;
}

const Header: React.FC<HeaderProps> = ({ provider }) => {
  const isNagad = provider === 'nagad';
  const isHome = !provider;
  const bkashLogo = 'https://i.postimg.cc/Hx21WWJ7/IMG-20260205-090841.jpg';
  const nagadLogo = '/nagad-logo.png';
  const logoSrc = isNagad ? nagadLogo : bkashLogo;

  if (isHome) {
    return (
      <header className="bg-white shadow-sm border-b border-gray-100 z-50" data-keep-theme data-keep-text>
        <div className="container mx-auto px-4 h-16 grid grid-cols-3 items-center">
          <div className="flex items-center justify-start">
            <img
              src={bkashLogo}
              alt="bKash Logo"
              className="h-10 w-auto object-contain rounded-lg shadow-sm"
            />
          </div>
          <div className="flex items-center justify-center">
            <span className="text-xl font-bold text-[#E2136E] tracking-tight">আমার লোন</span>
          </div>
          <div className="flex items-center justify-end">
            <img
              src={nagadLogo}
              alt="Nagad Logo"
              className="h-10 w-[97px] object-contain rounded-lg shadow-sm"
            />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 z-50" data-keep-theme data-keep-text>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center">
            <img 
              src={logoSrc} 
              alt="Logo" 
              className={`h-10 object-contain rounded-lg shadow-sm ${isNagad ? 'w-[97px]' : 'w-auto'}`}
            />
          </div>
          <span className={`text-xl font-bold text-[#E2136E] tracking-tight ${isNagad ? 'mt-2' : ''}`}>আমার লোন</span>
        </div>
        <nav className="hidden md:flex space-x-6 text-sm font-medium text-gray-600">
          <a href="#" className="hover:text-[#E2136E] transition-colors">হোম</a>
          <a href="#" className="hover:text-[#E2136E] transition-colors">আমাদের সম্পর্কে</a>
          <a href="#" className="hover:text-[#E2136E] transition-colors">শর্তাবলী</a>
          <a href="#" className="hover:text-[#E2136E] transition-colors">যোগাযোগ</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
