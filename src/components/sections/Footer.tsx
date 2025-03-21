
import { Zap } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="py-8 text-center text-sm text-gray-500 border-t border-white/5">
      <a 
        href="https://the9ines.com" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="hover:text-neon transition-colors inline-flex items-center gap-1 group"
      >
        <Zap className="w-4 h-4 transition-all duration-300 group-hover:fill-neon" />
        the9ines.com productions
        <Zap className="w-4 h-4 transition-all duration-300 group-hover:fill-neon" />
      </a>
    </footer>
  );
};
