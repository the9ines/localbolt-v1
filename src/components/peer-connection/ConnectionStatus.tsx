
import { Shield } from "lucide-react";
import { ConnectionQualityIndicator } from "./ConnectionQualityIndicator";
import WebRTCService from "@/services/webrtc/WebRTCService";

interface ConnectionStatusProps {
  isConnected: boolean;
  webrtc: WebRTCService | null;
  isLocalConnection?: boolean;
}

export const ConnectionStatus = ({ 
  isConnected, 
  webrtc,
  isLocalConnection = false 
}: ConnectionStatusProps) => {
  return (
    <div className="flex items-center justify-center gap-4 mb-4">
      <div className="flex items-center space-x-2 text-neon">
        <Shield 
          className={`w-5 h-5 transition-colors duration-300 ${
            isConnected ? "fill-neon text-neon" : "text-neon"
          }`} 
        />
        <span className="text-sm">End-to-End Encrypted</span>
      </div>
      
      {isConnected && webrtc && (
        <ConnectionQualityIndicator 
          webrtc={webrtc} 
          isLocal={isLocalConnection}
        />
      )}
    </div>
  );
};
