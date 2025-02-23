
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface HeroProps {
  onStartSharing: () => void;
}

export const Hero = ({ onStartSharing }: HeroProps) => {
  return (
    <div className="text-center space-y-6 animate-fade-up max-w-3xl mx-auto">
      <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
        Private, Server-Free File Sharing
      </h1>
      <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
        Like AirDrop, but for everyone. Transfer files directly between devices with end-to-end encryption. No servers, no storage, no limits.
      </p>
      <Button 
        size="lg" 
        className="bg-neon text-black hover:bg-neon/90 hover:scale-105 transition-all duration-300 hover:shadow-[0_0_20px_rgba(20,255,106,0.3)]"
        onClick={onStartSharing}
      >
        Start Sharing <ArrowRight className="ml-2" />
      </Button>
    </div>
  );
};
