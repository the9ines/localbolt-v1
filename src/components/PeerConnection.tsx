import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Shield, History, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc";
import { supabase } from "@/integrations/supabase/client";
import { getDevicePairs, saveDevicePair, DevicePair, updateDeviceLastSeen } from "@/services/webrtc/devicePairing";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const [peerCode, setPeerCode] = useState("");
  const [targetPeerCode, setTargetPeerCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [savedDevices, setSavedDevices] = useState<DevicePair[]>([]);
  const [isEditingCode, setIsEditingCode] = useState(false);
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
    const defaultCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const savedCode = localStorage.getItem('customPeerCode');
    const initialCode = savedCode || defaultCode;
    
    setPeerCode(initialCode);
    const rtcService = new WebRTCService(initialCode, handleFileReceive);
    setWebrtc(rtcService);
    
    const savedName = localStorage.getItem('deviceName') || `Device-${initialCode.substring(0, 4)}`;
    setDeviceName(savedName);
    localStorage.setItem('deviceName', savedName);

    checkSubscription();
    loadSavedDevices();

    return () => {
      rtcService.disconnect();
    };
  }, [handleFileReceive]);

  const checkSubscription = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", session.user.id)
        .single();
      
      setIsPremium(subscription?.status === "active");
    }
  };

  const loadSavedDevices = async () => {
    try {
      const devices = await getDevicePairs();
      setSavedDevices(devices);
    } catch (error) {
      console.error("Failed to load saved devices:", error);
    }
  };

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

  const validatePeerCode = (code: string) => {
    return /^[A-Z0-9]{6}$/.test(code);
  };

  const handlePeerCodeChange = (newCode: string) => {
    const formattedCode = newCode.toUpperCase();
    if (formattedCode.length <= 6) {
      setPeerCode(formattedCode);
    }
  };

  const handlePeerCodeSave = () => {
    if (!validatePeerCode(peerCode)) {
      toast({
        title: "Invalid peer code",
        description: "Peer code must be 6 characters (A-Z, 0-9)",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem('customPeerCode', peerCode);
    setIsEditingCode(false);
    
    if (webrtc) {
      webrtc.disconnect();
    }
    const newService = new WebRTCService(peerCode, handleFileReceive);
    setWebrtc(newService);

    toast({
      title: "Peer code updated",
      description: "Your custom peer code has been saved",
    });
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
      
      if (isPremium) {
        await saveDevicePair({
          peer_code: targetPeerCode,
          device_name: deviceName,
          network_id: peerCode,
        });
        loadSavedDevices();
      }
      
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

  const connectToSavedDevice = async (device: DevicePair) => {
    setTargetPeerCode(device.peer_code);
    await updateDeviceLastSeen(device.peer_code);
    handleConnect();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center space-x-2 text-neon mb-4">
        <Shield className="w-5 h-5" aria-hidden="true" />
        <span className="text-sm">End-to-End Encrypted</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="your-peer-code" className="text-sm font-medium leading-none">
            Your Peer Code
          </label>
          {isPremium && (
            <Input
              value={deviceName}
              onChange={(e) => {
                setDeviceName(e.target.value);
                localStorage.setItem('deviceName', e.target.value);
              }}
              className="w-40 h-7 text-xs bg-dark-accent/50"
              placeholder="Device Name"
            />
          )}
        </div>
        <div className="flex space-x-2">
          <Input
            id="your-peer-code"
            value={peerCode}
            onChange={(e) => handlePeerCodeChange(e.target.value)}
            readOnly={!isPremium || !isEditingCode}
            className="font-mono bg-dark-accent text-neon"
            maxLength={6}
            aria-label="Your peer code"
          />
          {isPremium && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (isEditingCode) {
                  handlePeerCodeSave();
                } else {
                  setIsEditingCode(true);
                }
              }}
              className="shrink-0"
              aria-label={isEditingCode ? "Save peer code" : "Edit peer code"}
            >
              {isEditingCode ? (
                <Check className="h-4 w-4 text-neon" aria-hidden="true" />
              ) : (
                <Edit2 className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}
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
          {isPremium && savedDevices.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <History className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-2 bg-dark-accent/95 backdrop-blur-lg border-white/10">
                <div className="space-y-1">
                  {savedDevices.map((device) => (
                    <button
                      key={device.peer_code}
                      onClick={() => connectToSavedDevice(device)}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
                    >
                      <div className="text-sm font-medium">{device.device_name}</div>
                      <div className="text-xs text-gray-400">{device.peer_code}</div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
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
