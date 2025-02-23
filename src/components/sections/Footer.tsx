
import { Zap } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="py-8 text-center text-sm text-gray-500 border-t border-white/5">
      <a 
        href="https://the9ines.com" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="hover:text-neon transition-colors inline-flex items-center gap-1"
      >
        <Zap className="w-4 h-4" />
        the9ines.com productions
      </a>
    </footer>
  );
};
