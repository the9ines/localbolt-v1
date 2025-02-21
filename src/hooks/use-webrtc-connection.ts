
import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { WebRTCError } from "@/types/webrtc-errors";
import { usePeerCode } from "./use-peer-code";
import { useTransferProgress } from "./use-transfer-progress";

export const useWebRTCConnection = (
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void
) => {
  const [targetPeerCode, setTargetPeerCode] = useState("");
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [remotePeerCode, setRemotePeerCode] = useState("");
  const { toast } = useToast();
  
  const { peerCode, setPeerCode, copied, copyToClipboard } = usePeerCode();
  const { transferProgress, handleProgress, handleCancelReceiving } = useTransferProgress(webrtc);

  const handleConnectionStateChange = useCallback((state: RTCPeerConnectionState) => {
    console.log('[UI] Connection state changed:', state);
    const connected = state === 'connected';
    setIsConnected(connected);
    onConnectionChange(connected, webrtc || undefined);

    if (!connected) {
      setRemotePeerCode("");
      setTargetPeerCode("");
    }
  }, [onConnectionChange, webrtc]);

  const handleRemotePeerCode = useCallback((code: string) => {
    console.log('[UI] Remote peer code updated:', code);
    if (code) {
      setRemotePeerCode(code);
      setTargetPeerCode(code);
      setIsConnected(true);
      if (webrtc) {
        onConnectionChange(true, webrtc);
      }
    }
  }, [webrtc, onConnectionChange]);

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
    onConnectionChange(false);
    
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
  }, [toast, onConnectionChange]);

  const handleDisconnect = useCallback(() => {
    if (webrtc) {
      webrtc.disconnect();
      setIsConnected(false);
      onConnectionChange(false);
      setTargetPeerCode("");
      setRemotePeerCode("");
      toast({
        title: "Disconnected",
        description: "Connection closed successfully",
      });
    }
  }, [webrtc, onConnectionChange, toast]);

  const handleConnect = useCallback(async () => {
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
      setIsConnected(false);
      onConnectionChange(false);
      
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
  }, [webrtc, targetPeerCode, onConnectionChange, toast, handleError]);

  useEffect(() => {
    if (!webrtc) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setPeerCode(code);
      console.log('[WEBRTC] Creating new service with code:', code);
      const rtcService = new WebRTCService(
        code,
        handleFileReceive,
        handleError,
        handleProgress,
        handleRemotePeerCode
      );
      rtcService.setConnectionStateHandler(handleConnectionStateChange);

      // Listen for disconnect signals from the other peer
      const handleBeforeUnload = () => {
        console.log('[WEBRTC] Page unloading, cleaning up...');
        rtcService.disconnect();
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      setWebrtc(rtcService);

      return () => {
        console.log('[WEBRTC] Cleaning up service');
        window.removeEventListener('beforeunload', handleBeforeUnload);
        rtcService.disconnect();
        setIsConnected(false);
        onConnectionChange(false);
      };
    }
  }, []); // Empty dependency array since we only want this to run once

  return {
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
  };
};
