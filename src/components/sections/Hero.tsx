
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface HeroProps {
  onStartSharing: () => void;
}

export const Hero = ({ onStartSharing }: HeroProps) => {
  return (
    <div className="text-center space-y-6 animate-fade-up max-w-3xl mx-auto">
      <div className="inline-flex items-center px-3 py-1 rounded-full border border-neon/20 bg-neon/5 text-neon text-sm mb-4">
        <span className="relative flex h-2 w-2 mr-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-neon"></span>
        </span>
        Secure File Transfer
      </div>
      <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
        Private, Server-Free File Sharing
      </h1>
      <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
        Like AirDrop, but for everyone. Transfer files directly between devices with military-grade encryption. No servers, no storage, no limits.
      </p>
      <Button 
        size="lg" 
        className="bg-neon text-black hover:bg-neon/90 hover:scale-105 transition-all duration-300"
        onClick={onStartSharing}
      >
        Start Sharing <ArrowRight className="ml-2" />
      </Button>
    </div>
  );
};
