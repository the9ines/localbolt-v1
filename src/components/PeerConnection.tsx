import { useEffect } from "react";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { TransferProgressBar } from "./file-upload/TransferProgress";
import { PeerCodeInput } from "./peer-connection/PeerCodeInput";
import { TargetPeerInput } from "./peer-connection/TargetPeerInput";
import { ConnectionStatus } from "./peer-connection/ConnectionStatus";
import { usePeerCode } from "@/hooks/use-peer-code";
import { useTransferProgress } from "@/hooks/use-transfer-progress";
import { usePeerConnection } from "@/hooks/use-peer-connection";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const {
    targetPeerCode,
    setTargetPeerCode,
    webrtc,
    setWebrtc,
    isConnected,
    setIsConnected,
    handleConnect,
    handleDisconnect,
    handleConnectionError
  } = usePeerConnection(onConnectionChange);

  const { peerCode, setPeerCode, copied, copyToClipboard } = usePeerCode();
  const { transferProgress, handleProgress, handleCancelReceiving } = useTransferProgress(webrtc);

  // Update connected peer code whenever connection state changes
  useEffect(() => {
    if (webrtc && isConnected) {
      const remotePeer = webrtc.getRemotePeerCode();
      console.log('[UI] Remote peer code updated:', remotePeer);
    }
  }, [webrtc, isConnected]);

  useEffect(() => {
    if (!webrtc) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setPeerCode(code);
      console.log('[WEBRTC] Creating new service with code:', code);
      
      const rtcService = new WebRTCService(
        code,
        handleFileReceive,
        handleConnectionError
      );

      rtcService.setConnectionStateHandler(handleConnectionStateChange);
      setWebrtc(rtcService);

      return () => {
        console.log('[WEBRTC] Cleaning up service');
        rtcService.disconnect();
        setIsConnected(false);
        onConnectionChange(false);
      };
    }
  }, []);

  const handleConnectionStateChange = (state: RTCPeerConnectionState) => {
    console.log('[UI] Connection state changed:', state);
    const connected = state === 'connected';
    setIsConnected(connected);
    onConnectionChange(connected, webrtc || undefined);
    
    // Update connected peer code when connection state changes
    if (connected && webrtc) {
      const remotePeerCode = webrtc.getRemotePeerCode();
      console.log('[UI] Setting connected peer code:', remotePeerCode);
    } else {
      setTargetPeerCode("");
    }
  };

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
          />
        </div>
      )}
    </div>
  );
};
