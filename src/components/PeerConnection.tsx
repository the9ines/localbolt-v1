
import { useEffect } from "react";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { TransferProgressBar } from "./file-upload/TransferProgress";
import { PeerCodeInput } from "./peer-connection/PeerCodeInput";
import { TargetPeerInput } from "./peer-connection/TargetPeerInput";
import { ConnectionStatus } from "./peer-connection/ConnectionStatus";
import { usePeerCode } from "@/hooks/use-peer-code";
import { useTransferProgress } from "@/hooks/use-transfer-progress";
import { useWebRTCConnection } from "@/hooks/use-webrtc-connection";
import { FileUpload } from "./file-upload/FileUpload";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const { peerCode, setPeerCode, copied, copyToClipboard } = usePeerCode();
  
  const {
    targetPeerCode,
    setTargetPeerCode,
    webrtc,
    isConnected,
    initializeWebRTC,
    handleConnect
  } = useWebRTCConnection({
    onConnectionChange,
    onProgress: (progress) => {
      if (webrtc) {
        handleProgress(progress);
      }
    }
  });

  const { transferProgress, handleProgress, handleCancelReceiving } = useTransferProgress(webrtc);

  useEffect(() => {
    if (!peerCode) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setPeerCode(code);
    }
  }, [peerCode, setPeerCode]);

  useEffect(() => {
    const rtcService = initializeWebRTC(peerCode);
    return () => {
      rtcService?.disconnect();
    };
  }, [peerCode, initializeWebRTC]);

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
          isConnected={isConnected}
        />
      </div>

      {isConnected && webrtc && (
        <div className="animate-fade-up">
          <FileUpload webrtc={webrtc} />
        </div>
      )}

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
