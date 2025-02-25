
import { Card } from "@/components/ui/card";
import { PeerConnection } from "@/components/PeerConnection";
import { FileUpload } from "@/components/file-upload/FileUpload";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { ForwardedRef, forwardRef, useEffect } from "react";

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
  // Add logging when the webrtc service changes
  useEffect(() => {
    if (webrtc) {
      console.log('[UI] Transfer component received WebRTC service:', !!webrtc);
      webrtc.setProgressCallback((progress) => {
        console.log('[UI] Direct progress callback in Transfer component:', progress);
      });
    }
  }, [webrtc]);

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
          Share files securely on your local network without uploading to the cloud
        </p>
      </div>

      <div className="relative">
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
