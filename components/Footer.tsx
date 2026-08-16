
import React from 'react';

interface FooterProps {
  onAdminClick?: () => void;
}

const Footer: React.FC<FooterProps> = ({ onAdminClick }) => {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white text-lg font-bold mb-4">আমার লোন</h3>
            <p className="text-sm leading-relaxed">
              আমরা বাংলাদেশের সাধারণ মানুষের আর্থিক প্রয়োজনে সহজ এবং দ্রুত ঋণ প্রদানের জন্য প্রতিশ্রুতিবদ্ধ। আপনার স্বপ্ন পূরণে আমরা আছি আপনার পাশে।
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">গুরুত্বপূর্ণ লিঙ্ক</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-blue-400">গোপনীয়তা নীতি</a></li>
              <li><a href="#" className="hover:text-blue-400">ব্যবহারকারীর নির্দেশিকা</a></li>
              <li><a href="#" className="hover:text-blue-400">লোন ক্যালকুলেটর</a></li>
              <li><a href="#" className="hover:text-blue-400">সচরাচর জিজ্ঞাসিত প্রশ্ন (FAQ)</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">সার্টিফাইড পার্টনার</h4>
            <div className="flex space-x-4">
              <div className="bg-white/10 p-2 rounded">bKash</div>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-xs">
          © <span 
            className="cursor-pointer hover:text-white hover:underline transition-colors px-1 font-bold" 
            onClick={onAdminClick}
          >2026</span> আমার লোন লিমিটেড। সর্বস্বত্ব সংরক্ষিত।
        </div>
      </div>
    </footer>
  );
};

export default Footer;
