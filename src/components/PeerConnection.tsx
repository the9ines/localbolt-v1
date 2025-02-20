import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc";
import { WebRTCError, WebRTCErrorCode } from "@/services/webrtc/types";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const [peerCode, setPeerCode] = useState("");
  const [targetPeerCode, setTargetPeerCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const { toast } = useToast();

  const handleError = useCallback((error: WebRTCError) => {
    console.error('WebRTC Error:', error);
    let title = 'Connection Error';
    let description = 'An unexpected error occurred';

    switch (error.code) {
      case WebRTCErrorCode.CONNECTION_FAILED:
        title = 'Connection Failed';
        description = 'Failed to establish connection with peer. Please try again.';
        break;
      case WebRTCErrorCode.ENCRYPTION_FAILED:
        title = 'Encryption Error';
        description = 'Failed to establish secure connection. Please try again.';
        break;
      case WebRTCErrorCode.DECRYPTION_FAILED:
        title = 'Decryption Error';
        description = 'Failed to decrypt received data. The connection may be compromised.';
        break;
      case WebRTCErrorCode.TRANSFER_FAILED:
        title = 'Transfer Failed';
        description = 'File transfer failed. Please try again.';
        break;
      case WebRTCErrorCode.NETWORK_ERROR:
        title = 'Network Error';
        description = 'Network connection issues detected. Check your internet connection.';
        break;
      case WebRTCErrorCode.PEER_DISCONNECTED:
        title = 'Peer Disconnected';
        description = 'The connection with your peer was lost.';
        onConnectionChange(false);
        break;
      case WebRTCErrorCode.SIGNALING_FAILED:
        title = 'Signaling Error';
        description = 'Failed to establish initial connection. Please try again.';
        break;
    }

    toast({
      title,
      description,
      variant: "destructive",
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

  useEffect(() => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setPeerCode(code);
    const rtcService = new WebRTCService(code, handleFileReceive, handleError);
    setWebrtc(rtcService);

    return () => {
      rtcService.disconnect();
    };
  }, [handleFileReceive, handleError]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(peerCode);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Peer code has been copied to your clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

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
      onConnectionChange(true, webrtc);
      
      toast({
        title: "Connected!",
        description: "Secure connection established",
      });
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center space-x-2 text-neon mb-4">
        <Shield className="w-5 h-5" aria-hidden="true" />
        <span className="text-sm">End-to-End Encrypted</span>
      </div>
      
      <div className="space-y-2">
        <label htmlFor="your-peer-code" className="text-sm font-medium leading-none">
          Your Peer Code
        </label>
        <div className="flex space-x-2">
          <Input
            id="your-peer-code"
            value={peerCode}
            readOnly
            className="font-mono bg-dark-accent text-neon"
            aria-label="Your peer code"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={copyToClipboard}
            className="shrink-0"
            aria-label={copied ? "Peer code copied" : "Copy peer code"}
          >
            {copied ? (
              <Check className="h-4 w-4 text-neon" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="target-peer-code" className="text-sm font-medium leading-none">
          Connect to Peer
        </label>
        <div className="flex space-x-2">
          <Input
            id="target-peer-code"
            value={targetPeerCode}
            onChange={(e) => setTargetPeerCode(e.target.value.toUpperCase())}
            placeholder="Enter peer code"
            className="font-mono bg-dark-accent placeholder:text-white/20"
            maxLength={6}
            aria-label="Enter target peer code"
          />
          <Button 
            onClick={handleConnect} 
            className="shrink-0 bg-neon text-black hover:bg-neon/90"
            aria-label="Connect to peer"
          >
            Connect
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PeerConnection;
