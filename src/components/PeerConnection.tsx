
import { useEffect } from "react";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { TransferProgressBar } from "./file-upload/TransferProgress";
import { PeerCodeInput } from "./peer-connection/PeerCodeInput";
import { TargetPeerInput } from "./peer-connection/TargetPeerInput";
import { ConnectionStatus } from "./peer-connection/ConnectionStatus";
import { usePeerCode } from "@/hooks/use-peer-code";
import { useTransferProgress } from "@/hooks/use-transfer-progress";
import { usePeerConnection } from "@/hooks/use-peer-connection";
import { useToast } from "@/hooks/use-toast";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const {
    targetPeerCode,
    setTargetPeerCode,
    connectedPeerCode,
    webrtc,
    setWebrtc,
    isConnected,
    setIsConnected,
    handleConnect,
    handleDisconnect,
    handleConnectionError
  } = usePeerConnection(onConnectionChange);

  const { peerCode, setPeerCode, copied, copyToClipboard } = usePeerCode();
  const { toast } = useToast();
  const { 
    transferProgress, 
    handleProgress, 
    handleCancelReceiving,
    handlePauseTransfer,
    handleResumeTransfer,
    clearProgress 
  } = useTransferProgress(webrtc);

  useEffect(() => {
    if (!isConnected && transferProgress) {
      clearProgress();
    }
  }, [isConnected, transferProgress, clearProgress]);

  useEffect(() => {
    if (!webrtc) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setPeerCode(code);
      console.log('[WEBRTC] Creating new service with code:', code);
      const rtcService = new WebRTCService(code, handleFileReceive, handleConnectionError, handleProgress);
      
      // Add connection state handler
      rtcService.setConnectionStateHandler((state) => {
        console.log('[WEBRTC] Connection state changed:', state);
        const connected = state === 'connected';
        setIsConnected(connected);
        onConnectionChange(connected, rtcService);
        
        if (connected) {
          toast({
            title: "Connected",
            description: "Peer connection established successfully"
          });
        } else if (state === 'disconnected' || state === 'failed') {
          toast({
            title: "Disconnected",
            description: "Peer connection lost",
            variant: "destructive"
          });
          setTargetPeerCode("");
        }
      });
      
      setWebrtc(rtcService);

      return () => {
        console.log('[WEBRTC] Cleaning up service');
        rtcService.disconnect();
        setIsConnected(false);
        onConnectionChange(false);
        clearProgress();
      };
    }
  }, []);

  useEffect(() => {
    if (webrtc && isConnected) {
      const remotePeer = webrtc.getRemotePeerCode();
      console.log('[UI] Remote peer code updated:', remotePeer);
      setTargetPeerCode(remotePeer);
    }
  }, [webrtc, isConnected]);

  const handleFileReceive = (file: Blob, filename: string) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <ConnectionStatus isConnected={isConnected} />
      
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
          onDisconnect={handleDisconnect}
          isConnected={isConnected}
          remotePeerCode={webrtc?.getRemotePeerCode()}
        />
      </div>

      {transferProgress && (
        <div className="space-y-2 animate-fade-up">
          <TransferProgressBar 
            progress={transferProgress}
            onCancel={handleCancelReceiving}
            onPause={handlePauseTransfer}
            onResume={handleResumeTransfer}
          />
        </div>
      )}
    </div>
  );
};
