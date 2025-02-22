
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";

export const Header = () => {
  return (
    <header className="border-b border-white/10 bg-dark/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-8 h-8 text-neon" />
            <div className="flex items-baseline">
              <span className="text-xl font-semibold">LocalBolt</span>
              <span className="text-neon text-sm ml-2">Beta 0.3.35</span>
            </div>
          </div>
          
          <Card className="glass flex items-center px-4 py-1.5 space-x-2">
            <div className="w-2 h-2 rounded-full bg-neon animate-pulse" />
            <span className="text-sm text-white/80">Network Active</span>
          </Card>
        </div>
      </div>
    </header>
  );
};
