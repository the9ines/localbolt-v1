
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

export const Header = () => {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.href = '/';
    }
  };

  return (
    <header className="border-b border-white/10 bg-dark/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link 
            to="/" 
            onClick={handleLogoClick}
            className="flex items-center space-x-2 group"
          >
            <Zap className="w-8 h-8 text-neon transition-all duration-300 group-hover:fill-neon" />
            <span className="text-xl font-semibold">LocalBolt</span>
          </Link>
          
          <Card className="glass flex items-center px-4 py-1.5 space-x-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-neon animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm text-white/80">
              {isOnline ? 'Network Active' : 'LAN Only'}
            </span>
          </Card>
        </div>
      </div>
    </header>
  );
};
