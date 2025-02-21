
import { useState, useCallback } from 'react';
import { useToast } from './use-toast';
import WebRTCService from '@/services/webrtc/WebRTCService';
import { WebRTCError } from '@/types/webrtc-errors';

export const usePeerConnection = (
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void
) => {
  const [targetPeerCode, setTargetPeerCode] = useState("");
  const [remotePeerCode, setRemotePeerCode] = useState("");
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  const handleConnectionError = useCallback((error: WebRTCError) => {
    console.error(`[${error.name}]`, error.message, error.details);
    setIsConnected(false);
    setTargetPeerCode(""); 
    setRemotePeerCode("");  // Clear remote peer code on error
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
      setIsConnected(false);
      onConnectionChange(false);
      
      toast({
        title: "Connecting...",
        description: "Establishing secure connection",
      });
      
      await webrtc.connect(targetPeerCode);
      
      setIsConnected(true);
      setRemotePeerCode(targetPeerCode); // Store the remote peer code
      onConnectionChange(true, webrtc);
      
      toast({
        title: "Connected!",
        description: "Secure connection established",
      });
    } catch (error) {
      setIsConnected(false);
      setRemotePeerCode(""); // Clear remote peer code on error
      if (error instanceof WebRTCError) {
        handleConnectionError(error);
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

  const handleDisconnect = useCallback(() => {
    if (webrtc) {
      webrtc.disconnect();
      setIsConnected(false);
      setTargetPeerCode("");
      setRemotePeerCode(""); // Clear remote peer code on disconnect
      onConnectionChange(false);
      toast({
        title: "Disconnected",
        description: "Connection closed successfully",
      });
    }
  }, [webrtc, toast, onConnectionChange]);

  return {
    targetPeerCode,
    setTargetPeerCode,
    remotePeerCode,
    setRemotePeerCode, // Export setRemotePeerCode
    webrtc,
    setWebrtc,
    isConnected,
    setIsConnected,
    handleConnect,
    handleDisconnect,
    handleConnectionError
  };
};
