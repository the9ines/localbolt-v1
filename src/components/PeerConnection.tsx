
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Shield, Link, Unlink, Computer, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc";
import { supabase } from "@/integrations/supabase/client";

interface PeerDevice {
  code: string;
  type: 'computer' | 'smartphone';
}

interface PeerConnectionProps {
  onConnectionChange: (connected: boolean, service?: WebRTCService) => void;
}

interface NetworkDevice {
  code: string;
  type: 'computer' | 'smartphone';
  online_at: string;
}

const isValidPeerDevice = (device: any): device is PeerDevice => {
  return (
    typeof device === 'object' &&
    typeof device.code === 'string' &&
    (device.type === 'computer' || device.type === 'smartphone')
  );
};

export const PeerConnection = ({ onConnectionChange }: PeerConnectionProps) => {
  const [peerCode, setPeerCode] = useState("");
  const [targetPeerCode, setTargetPeerCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([]);
  const [pairedDevices, setPairedDevices] = useState<PeerDevice[]>(() => {
    try {
      const saved = localStorage.getItem("pairedDevices");
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidPeerDevice);
    } catch {
      return [];
    }
  });
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
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setPeerCode(code);
    const rtcService = new WebRTCService(code, handleFileReceive);
    setWebrtc(rtcService);

    // Set up presence channel for device discovery
    const deviceType = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) 
      ? 'smartphone' as const 
      : 'computer' as const;

    const channel = supabase.channel('online-devices')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const devices = Object.values(state).flat().map((device: any) => ({
          code: device.code,
          type: device.type,
          online_at: device.online_at,
        }));
        setNetworkDevices(devices);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            code,
            type: deviceType,
            online_at: new Date().toISOString(),
          });
        }
      });

    // Try to connect to paired devices
    pairedDevices.forEach(async (device) => {
      try {
        await rtcService.connect(device.code);
        onConnectionChange(true, rtcService);
        toast({
          title: "Reconnected",
          description: `Automatically reconnected to paired device ${device.code}`,
        });
      } catch (error) {
        console.error("Failed to connect to paired device:", error);
      }
    });

    return () => {
      rtcService.disconnect();
      channel.unsubscribe();
    };
  }, [handleFileReceive, onConnectionChange, pairedDevices, toast]);

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

  const handleConnect = async (targetCode: string) => {
    if (!webrtc) return;
    
    if (targetCode.length < 6) {
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
      
      await webrtc.connect(targetCode);
      onConnectionChange(true, webrtc);
      
      // Save device for future connections
      if (!pairedDevices.some(device => device.code === targetCode)) {
        const deviceType = networkDevices.find(d => d.code === targetCode)?.type || 
          (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'smartphone' as const : 'computer' as const);
        
        const newPairedDevices = [...pairedDevices, { code: targetCode, type: deviceType }];
        setPairedDevices(newPairedDevices);
        localStorage.setItem("pairedDevices", JSON.stringify(newPairedDevices));
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

  const removePairedDevice = (deviceCode: string) => {
    const newPairedDevices = pairedDevices.filter(device => device.code !== deviceCode);
    setPairedDevices(newPairedDevices);
    localStorage.setItem("pairedDevices", JSON.stringify(newPairedDevices));
    toast({
      title: "Device unpaired",
      description: "Device has been removed from paired devices",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center space-x-2 text-neon mb-4">
        <Shield className="w-5 h-5" />
        <span className="text-sm">End-to-End Encrypted</span>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Your Peer Code</label>
        <div className="flex space-x-2">
          <Input
            value={peerCode}
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
          Available Devices
        </label>
        <div className="space-y-2">
          {networkDevices
            .filter(device => device.code !== peerCode)
            .map((device) => (
              <div
                key={device.code}
                className="flex items-center justify-between p-2 bg-dark-accent/50 rounded hover:bg-dark-accent/70 transition-colors cursor-pointer"
                onClick={() => handleConnect(device.code)}
              >
                <div className="flex items-center space-x-2">
                  {device.type === 'computer' ? (
                    <Computer className="w-4 h-4 text-neon" />
                  ) : (
                    <Smartphone className="w-4 h-4 text-neon" />
                  )}
                  <span className="font-mono text-sm">{device.code}</span>
                </div>
                <Link className="w-4 h-4 text-neon" />
              </div>
            ))}
          {networkDevices.length <= 1 && (
            <div className="text-sm text-gray-400 text-center py-2">
              No other devices found on the network
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">
          Manual Connection
        </label>
        <div className="flex space-x-2">
          <Input
            value={targetPeerCode}
            onChange={(e) => setTargetPeerCode(e.target.value.toUpperCase())}
            placeholder="Enter peer code"
            className="font-mono bg-dark-accent placeholder:text-white/20"
            maxLength={6}
          />
          <Button 
            onClick={() => handleConnect(targetPeerCode)} 
            className="shrink-0 bg-neon text-black hover:bg-neon/90"
          >
            Connect
          </Button>
        </div>
      </div>

      {pairedDevices.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Paired Devices</label>
          <div className="space-y-2">
            {pairedDevices.map((device) => (
              <div
                key={device.code}
                className="flex items-center justify-between p-2 bg-dark-accent rounded"
              >
                <div className="flex items-center space-x-2">
                  {device.type === 'computer' ? (
                    <Computer className="w-4 h-4 text-neon" />
                  ) : (
                    <Smartphone className="w-4 h-4 text-neon" />
                  )}
                  <span className="font-mono text-sm">{device.code}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePairedDevice(device.code)}
                  className="text-white/50 hover:text-white"
                >
                  <Unlink className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
