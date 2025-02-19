
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Copy, Check, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc";
import QRCode from "qrcode";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const [peerCode, setPeerCode] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [targetPeerCode, setTargetPeerCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const { toast } = useToast();

  const generateQRCode = useCallback(async (code: string) => {
    try {
      const url = await QRCode.toDataURL(code, {
        color: {
          dark: '#39FF14',
          light: '#00000000'
        },
        width: 200,
        margin: 1
      });
      setQrCodeUrl(url);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  }, []);

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
    generateQRCode(code);
    const rtcService = new WebRTCService(code, handleFileReceive);
    setWebrtc(rtcService);

    return () => {
      rtcService.disconnect();
    };
  }, [handleFileReceive, generateQRCode]);

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
        description: "Establishing peer connection",
      });
      
      await webrtc.connect(targetPeerCode);
      onConnectionChange(true, webrtc);
      
      toast({
        title: "Connected!",
        description: "Peer connection established successfully",
      });
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Failed to establish peer connection",
        variant: "destructive",
      });
      onConnectionChange(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Your Connection Code</h3>
          <div className="flex space-x-2">
            <Input
              value={peerCode}
              readOnly
              className="font-mono bg-dark text-neon text-lg"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-neon" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="flex justify-center">
            {qrCodeUrl && (
              <Card className="p-4 bg-dark border border-white/10">
                <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32" />
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Connect to Peer</h3>
          <div className="space-y-2">
            <Input
              value={targetPeerCode}
              onChange={(e) => setTargetPeerCode(e.target.value.toUpperCase())}
              placeholder="Enter peer code or scan QR"
              className="font-mono bg-dark placeholder:text-white/20 text-lg"
              maxLength={6}
            />
            <Button 
              onClick={handleConnect} 
              className="w-full bg-neon text-black hover:bg-neon/90 text-lg h-12"
            >
              Connect
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
