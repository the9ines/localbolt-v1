
import { Card } from "@/components/ui/card";
import { PeerConnection } from "@/components/PeerConnection";
import { FileUpload } from "@/components/file-upload/FileUpload";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { ForwardedRef, forwardRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

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
  const hasLocalPeers = discoveryStatus?.localPeersCount > 0;

  return (
    <Card 
      ref={ref}
      className="relative overflow-hidden p-8 max-w-3xl mx-auto space-y-6 bg-dark-accent/30 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)] animate-fade-up transition-all duration-300 hover:shadow-[0_0_30px_rgba(20,255,106,0.3)] hover:border-neon/30"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-neon/5 via-transparent to-transparent opacity-50" />
      
      <div className="relative space-y-4 text-center">
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Fast, Private File Transfer
            {discoveryStatus?.isOnline ? <Wifi className="text-neon" /> : <WifiOff className="text-red-500" />}
          </h2>
        </div>
        <p className="text-muted-foreground">
          Share files securely with nearby devices or over the internet
        </p>
      </div>

      <div className="relative">
        {hasLocalPeers && (
          <Card className="mb-4 p-4 border-neon/20 bg-black/20">
            <p className="text-sm text-neon mb-2">
              {discoveryStatus.localPeersCount} nearby {discoveryStatus.localPeersCount === 1 ? 'device' : 'devices'} found
            </p>
            <div className="flex flex-wrap gap-2">
              {discoveryStatus.localPeers.map(peerId => (
                <Badge key={peerId} variant="outline" className="bg-black/30">
                  {peerId}
                </Badge>
              ))}
            </div>
          </Card>
        )}

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
