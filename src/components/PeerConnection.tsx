import { useEffect } from "react";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { TransferProgressBar } from "./file-upload/TransferProgress";
import { PeerCodeInput } from "./peer-connection/PeerCodeInput";
import { TargetPeerInput } from "./peer-connection/TargetPeerInput";
import { ConnectionStatus } from "./peer-connection/ConnectionStatus";
import { usePeerCode } from "@/hooks/use-peer-code";
import { useTransferProgress } from "@/hooks/use-transfer-progress";
import { usePeerConnection } from "@/hooks/use-peer-connection";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

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
      const rtcService = new WebRTCService(code, handleFileReceive, handleConnectionError, handleProgress);
      rtcService.setConnectionStateHandler(handleConnectionStateChange);
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

  const handleConnectionStateChange = (state: RTCPeerConnectionState) => {
    console.log('[UI] Connection state changed:', state);
    setIsConnected(state === 'connected');
    onConnectionChange(state === 'connected', webrtc || undefined);
    
    if (state !== 'connected' && transferProgress) {
      clearProgress();
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

  const discoveryStatus = webrtc?.getDiscoveryStatus?.();
  const hasLocalPeers = discoveryStatus?.localPeersCount > 0;

  return (
    <div className="space-y-4">
      <ConnectionStatus isConnected={isConnected} />
      
      <div className="space-y-4 touch-manipulation">
        {hasLocalPeers && (
          <Card className="p-4 border-neon/20 bg-black/20">
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
