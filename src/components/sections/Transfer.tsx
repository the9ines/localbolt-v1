
import { Card } from "@/components/ui/card";
import { PeerConnection } from "@/components/PeerConnection";
import { FileUpload } from "@/components/file-upload/FileUpload";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { ForwardedRef, forwardRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

interface TransferProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
  isConnected: boolean;
  webrtc: WebRTCService | null;
}

export const Transfer = forwardRef(({ 
  onConnectionChange, 
  isConnected, 
  webrtc 
}: TransferProps, ref: ForwardedRef<HTMLDivElement>) => {
  const { toast } = useToast();

  useEffect(() => {
    if (webrtc) {
      webrtc.setNetworkStateHandler((isOnline) => {
        if (!isOnline) {
          toast({
            title: "Network Connection Lost",
            description: "Operating in LAN-only mode. Some features may be limited.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Network Connection Restored",
            description: "Full functionality has been restored.",
          });
        }
      });
    }
  }, [webrtc, toast]);

  const discoveryStatus = webrtc?.getDiscoveryStatus?.();

  return (
    <Card 
      ref={ref}
      className="relative overflow-hidden p-8 max-w-3xl mx-auto space-y-6 bg-dark-accent/30 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)] animate-fade-up transition-all duration-300 hover:shadow-[0_0_30px_rgba(20,255,106,0.3)] hover:border-neon/30"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-neon/5 via-transparent to-transparent opacity-50" />
      
      <div className="relative space-y-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Fast, Private File Transfer
        </h2>
        <p className="text-muted-foreground">
          Share files securely with nearby devices or over the internet
        </p>
      </div>

      <div className="relative">
        <div className="flex items-center justify-center space-x-2 text-neon mb-6">
          <Shield 
            className={`w-5 h-5 transition-colors duration-300 ${
              isConnected ? "fill-neon text-neon" : "text-neon"
            }`} 
          />
          <span className="text-sm">End-to-End Encrypted</span>
        </div>

        <PeerConnection onConnectionChange={onConnectionChange} />
        
        {isConnected && webrtc && (
          <div className="animate-fade-in mt-6">
            <FileUpload webrtc={webrtc} />
          </div>
        )}
      </div>
    </Card>
  );
});

Transfer.displayName = 'Transfer';
