
import { useState, useEffect, useCallback } from "react";
import { Shield } from "lucide-react";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { WebRTCError } from "@/types/webrtc-errors";
import { TransferProgressBar } from "./file-upload/TransferProgress";
import { PeerCodeInput } from "./peer-connection/PeerCodeInput";
import { TargetPeerInput } from "./peer-connection/TargetPeerInput";
import { usePeerCode } from "@/hooks/use-peer-code";
import { useTransferProgress } from "@/hooks/use-transfer-progress";
import { FileUpload } from "./file-upload/FileUpload";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const [targetPeerCode, setTargetPeerCode] = useState("");
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const { peerCode, setPeerCode, copied, copyToClipboard } = usePeerCode();
  const { transferProgress, handleProgress, handleCancelReceiving } = useTransferProgress(webrtc);

  const handleFileReceive = useCallback((file: Blob, filename: string) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleError = useCallback((error: WebRTCError) => {
    console.error(`[${error.name}]`, error.message, error.details);
  }, []);

  useEffect(() => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setPeerCode(code);
    const rtcService = new WebRTCService(code, handleFileReceive, handleError, handleProgress);
    setWebrtc(rtcService);

    return () => {
      rtcService.disconnect();
    };
  }, [handleFileReceive, handleError, handleProgress, setPeerCode]);

  const handleConnect = async () => {
    if (!webrtc) return;
    
    if (targetPeerCode.length < 6) {
      console.error('Invalid peer code');
      return;
    }
    
    try {
      await webrtc.connect(targetPeerCode);
      setIsConnected(true);
      onConnectionChange(true, webrtc);
    } catch (error) {
      console.error('[CONNECTION] Error:', error);
      onConnectionChange(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center space-x-2 text-neon mb-4">
        <Shield className="w-5 h-5" />
        <span className="text-sm">End-to-End Encrypted</span>
      </div>
      
      <div className="space-y-6">
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

        {transferProgress && (
          <div className="space-y-2 animate-fade-up">
            <TransferProgressBar 
              progress={transferProgress}
              onCancel={handleCancelReceiving}
            />
          </div>
        )}

        {isConnected && webrtc && !transferProgress && (
          <div className="animate-fade-in">
            <FileUpload webrtc={webrtc} />
          </div>
        )}
      </div>
    </div>
  );
};
