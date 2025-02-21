
import { Shield } from "lucide-react";

interface SecurityBadgeProps {
  isConnected: boolean;
}

export const SecurityBadge = ({ isConnected }: SecurityBadgeProps) => {
  return (
    <div className="flex items-center justify-center space-x-2 text-neon mb-4">
      <Shield 
        className={`w-5 h-5 transition-colors duration-300 ${
          isConnected ? "fill-neon text-neon" : "text-neon"
        }`} 
      />
      <span className="text-sm">End-to-End Encrypted</span>
    </div>
  );
};
