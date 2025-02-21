
import { useWebRTCConnection } from "@/hooks/use-webrtc-connection";
import { TransferProgressBar } from "./file-upload/TransferProgress";
import { PeerCodeInput } from "./peer-connection/PeerCodeInput";
import { TargetPeerInput } from "./peer-connection/TargetPeerInput";
import { SecurityBadge } from "./peer-connection/SecurityBadge";
import type WebRTCService from "@/services/webrtc/WebRTCService";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const {
    peerCode,
    copied,
    copyToClipboard,
    targetPeerCode,
    setTargetPeerCode,
    isConnected,
    handleConnect,
    handleDisconnect,
    transferProgress,
    handleCancelReceiving
  } = useWebRTCConnection(onConnectionChange);

  return (
    <div className="space-y-4">
      <SecurityBadge isConnected={isConnected} />
      
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
