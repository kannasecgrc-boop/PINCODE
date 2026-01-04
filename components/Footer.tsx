import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full py-6 text-center text-slate-400 text-sm mt-auto">
      <p>&copy; {new Date().getFullYear()} WorldPincode. Powered by Google Gemini.</p>
    </footer>
  );
};

export default Footer;