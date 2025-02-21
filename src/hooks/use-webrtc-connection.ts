
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import WebRTCService from '@/services/webrtc/WebRTCService';
import { WebRTCError } from '@/types/webrtc-errors';
import type { TransferProgress } from '@/services/webrtc/types/transfer';

interface UseWebRTCConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
  onProgress: (progress: TransferProgress) => void;
}

export const useWebRTCConnection = ({ onConnectionChange, onProgress }: UseWebRTCConnectionProps) => {
  const [targetPeerCode, setTargetPeerCode] = useState("");
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  const handleConnectionStateChange = useCallback((state: RTCPeerConnectionState) => {
    console.log('[UI] Connection state changed:', state);
    const connected = state === 'connected';
    setIsConnected(connected);
    
    if (webrtc) {
      onConnectionChange(connected, webrtc);
      if (connected) {
        const remotePeerCode = webrtc.getRemotePeerCode();
        if (remotePeerCode) {
          setTargetPeerCode(remotePeerCode);
        }
      } else {
        setTargetPeerCode("");
      }
    }
  }, [onConnectionChange, webrtc]);

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
    
    let title = "Connection Error";
    let description = "Failed to establish connection";

    switch (error.name) {
      case 'ConnectionError':
        title = "Connection Failed";
        description = "Unable to connect to peer. Please try again.";
        break;
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
  }, [toast]);

  const initializeWebRTC = useCallback((peerCode: string) => {
    if (!webrtc && peerCode) {
      console.log('[INIT] Creating WebRTC service with code:', peerCode);
      const rtcService = new WebRTCService(
        peerCode,
        handleFileReceive,
        handleError,
        onProgress,
        handleConnectionStateChange
      );
      setWebrtc(rtcService);
      return rtcService;
    }
    return webrtc;
  }, [webrtc, handleFileReceive, handleError, onProgress, handleConnectionStateChange]);

  const handleConnect = async () => {
    if (!webrtc) return;
    
    if (isConnected) {
      webrtc.disconnect();
      setIsConnected(false);
      setTargetPeerCode("");
      onConnectionChange(false);
      toast({
        title: "Disconnected",
        description: "Connection closed",
      });
      return;
    }
    
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
      
      toast({
        title: "Connected!",
        description: "Secure connection established",
      });
    } catch (error) {
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
      setIsConnected(false);
      setTargetPeerCode("");
    }
  };

  return {
    targetPeerCode,
    setTargetPeerCode,
    webrtc,
    isConnected,
    initializeWebRTC,
    handleConnect
  };
};
