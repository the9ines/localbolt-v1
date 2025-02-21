
import { useState, useEffect, useCallback } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { WebRTCError } from "@/types/webrtc-errors";
import { TransferProgressBar } from "./file-upload/TransferProgress";
import { PeerCodeInput } from "./peer-connection/PeerCodeInput";
import { TargetPeerInput } from "./peer-connection/TargetPeerInput";
import { usePeerCode } from "@/hooks/use-peer-code";
import { useTransferProgress } from "@/hooks/use-transfer-progress";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const [targetPeerCode, setTargetPeerCode] = useState("");
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  
  const { peerCode, setPeerCode, copied, copyToClipboard } = usePeerCode();
  const { transferProgress, handleProgress, handleCancelReceiving } = useTransferProgress(webrtc);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    onConnectionChange(false);
    
    toast({
      title: "Disconnected",
      duration: 2000, // 2 seconds
    });
  }, [toast, onConnectionChange]);

  const handleFileReceive = useCallback((file: Blob, filename: string) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "File received",
      description: `Successfully received ${filename}`,
    });
  }, [toast]);

  const handleError = useCallback((error: WebRTCError) => {
    console.error(`[${error.name}]`, error.message, error.details);
    setIsConnected(false);
    
    let title = "Connection Error";
    let description = "Failed to establish connection";

    switch (error.name) {
      case 'ConnectionError':
        handleDisconnect();
        return;
      case 'SignalingError':
        title = "Signaling Error";
        description = "Failed to establish initial connection. Please check your peer code.";
        break;
      case 'TransferError':
        title = "Transfer Failed";
        description = "File transfer failed. Please try again.";
        break;
      case 'EncryptionError':
        title = "Security Error";
        description = "Failed to encrypt/decrypt data. Please reconnect.";
        break;
    }

    toast({
      title,
      description,
      variant: "destructive",
    });
  }, [toast, handleDisconnect]);

  useEffect(() => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setPeerCode(code);
    const rtcService = new WebRTCService(code, handleFileReceive, handleError, handleProgress);
    
    // Set up connection state monitoring
    rtcService.connectionManager.onConnectionStateChange = (state) => {
      if (state === 'connected') {
        setIsConnected(true);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        handleDisconnect();
      }
    };
    
    setWebrtc(rtcService);

    return () => {
      rtcService.disconnect();
      setIsConnected(false);
    };
  }, [handleFileReceive, handleError, handleProgress, handleDisconnect, setPeerCode]);

  const handleConnect = async () => {
    if (!webrtc) return;
    
    if (targetPeerCode.length < 6) {
      toast({
        title: "Invalid peer code",
        description: "Please enter a valid peer code",
        variant: "destructive",
      });
      return;
    }
    
    try {
      toast({
        title: "Connecting...",
        description: "Establishing secure connection",
      });
      
      await webrtc.connect(targetPeerCode);
      setIsConnected(true);
      onConnectionChange(true, webrtc);
      
      toast({
        title: "Connected!",
        description: "Secure connection established",
      });
    } catch (error) {
      setIsConnected(false);
      if (error instanceof WebRTCError) {
        handleError(error);
      } else {
        console.error('[UNEXPECTED]', error);
        toast({
          title: "Unexpected Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      }
      onConnectionChange(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center space-x-2 text-neon mb-4">
        {isConnected ? (
          <ShieldCheck className="w-5 h-5 fill-neon transition-all duration-300" />
        ) : (
          <Shield className="w-5 h-5 transition-all duration-300" />
        )}
        <span className="text-sm">End-to-End Encrypted</span>
      </div>
      
      <div className="space-y-4 touch-manipulation">
        <PeerCodeInput 
          peerCode={peerCode}
          copied={copied}
          onCopy={copyToClipboard}
        />

        <TargetPeerInput
          targetPeerCode={targetPeerCode}
          onTargetPeerCodeChange={setTargetPeerCode}
          onConnect={handleConnect}
        />
      </div>

      {transferProgress && (
        <div className="space-y-2 animate-fade-up">
          <TransferProgressBar 
            progress={transferProgress}
            onCancel={handleCancelReceiving}
          />
        </div>
      )}
    </div>
  );
};
