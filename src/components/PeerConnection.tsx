
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc";

const TEXAS_FIGURES = [
  "DAVY_CROCKETT",
  "SAM_HOUSTON",
  "STEPHEN_AUSTIN",
  "WILLIAM_TRAVIS",
  "JIM_BOWIE",
  "JANE_LONG",
  "JUAN_SEGUIN",
  "EMILY_WEST",
  "LORENZO_ZAVALA",
  "JAMES_FANNIN",
  "ANSON_JONES",
  "GAIL_BORDEN",
  "JOSE_NAVARRO",
  "MARY_MAVERICK",
  "BEN_MILAM",
  "ALMARON_DICKINSON",
  "SUSANNA_DICKINSON",
  "ELIZABETH_CROCKETT",
  "HENRY_SMITH",
  "JAMES_BONHAM"
];

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const [peerCode, setPeerCode] = useState("");
  const [targetPeerCode, setTargetPeerCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const { toast } = useToast();

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
    // Generate a random Texas figure name instead of a random code
    const randomIndex = Math.floor(Math.random() * TEXAS_FIGURES.length);
    const name = TEXAS_FIGURES[randomIndex];
    setPeerCode(name);
    const rtcService = new WebRTCService(name, handleFileReceive);
    setWebrtc(rtcService);

    return () => {
      rtcService.disconnect();
    };
  }, [handleFileReceive]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(peerCode);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Name has been copied to your clipboard",
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
    
    if (!TEXAS_FIGURES.includes(targetPeerCode)) {
      toast({
        title: "Invalid name",
        description: "Please enter a valid Texas figure name",
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
      toast({
        title: "Connection failed",
        description: "Failed to establish connection",
        variant: "destructive",
      });
      onConnectionChange(false);
    }
  };

  const formatName = (name: string) => {
    return name.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center space-x-2 text-neon mb-4">
        <Shield className="w-5 h-5" />
        <span className="text-sm">End-to-End Encrypted</span>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Your Texas Figure</label>
        <div className="flex space-x-2">
          <Input
            value={formatName(peerCode)}
            readOnly
            className="font-mono bg-dark-accent text-neon"
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
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">
          Connect to Peer
        </label>
        <div className="flex space-x-2">
          <Input
            value={targetPeerCode}
            onChange={(e) => setTargetPeerCode(e.target.value.toUpperCase())}
            placeholder="Enter Texas figure name"
            className="font-mono bg-dark-accent placeholder:text-white/20"
          />
          <Button onClick={handleConnect} className="shrink-0 bg-neon text-black hover:bg-neon/90">
            Connect
          </Button>
        </div>
        <div className="text-sm text-gray-400 mt-2">
          Available names: {TEXAS_FIGURES.slice(0, 3).map(formatName).join(", ")}, and more...
        </div>
      </div>
    </div>
  );
};
