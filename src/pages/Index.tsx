import { useState } from "react";
import { lazy, Suspense } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Shield, Wifi, Database, Zap, Smartphone, Laptop, Monitor, Copy, Check } from "lucide-react";
import { sanitizeString } from "@/utils/sanitizer";
import WebRTCService from "@/services/webrtc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const FileUpload = lazy(() => import("@/components/FileUpload"));
const PeerConnection = lazy(() => import("@/components/PeerConnection"));

interface NetworkDevice {
  id: string;
  name: string;
  type: 'smartphone' | 'laptop' | 'desktop';
  peerCode: string;
}

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const networkDevices: NetworkDevice[] = [
    { id: '1', name: 'iPhone 13', type: 'smartphone', peerCode: 'ABC123' },
    { id: '2', name: 'MacBook Pro', type: 'laptop', peerCode: 'DEF456' },
    { id: '3', name: 'Desktop PC', type: 'desktop', peerCode: 'GHI789' },
  ];

  const handleConnectionChange = (connected: boolean, service?: WebRTCService) => {
    setIsConnected(connected);
    if (service) {
      setWebrtc(service);
    }
  };

  const renderSafeContent = (content: string) => {
    return sanitizeString(content);
  };

  const getDeviceIcon = (type: NetworkDevice['type']) => {
    switch (type) {
      case 'smartphone':
        return <Smartphone className="w-5 h-5 text-neon" />;
      case 'laptop':
        return <Laptop className="w-5 h-5 text-neon" />;
      case 'desktop':
        return <Monitor className="w-5 h-5 text-neon" />;
    }
  };

  const copyPeerCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({
        title: "Peer code copied",
        description: "Ready to connect to this device",
      });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-dark text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.1),rgba(0,0,0,0))]" />
      
      <div className="relative z-10">
        <Header />
        
        <main className="container mx-auto px-4 py-12 space-y-12">
          <div className="text-center space-y-4 animate-fade-up">
            <h1 className="text-5xl font-bold tracking-tight">
              {renderSafeContent("Private, Server-Free File Sharing")}
            </h1>
            <p className="text-xl text-gray-100 max-w-2xl mx-auto leading-relaxed font-medium">
              <span className="inline-block">
                {renderSafeContent("Like AirDrop, but for everyone. Transfer files directly between devices with end-to-end encryption. No servers, no storage, no limits.")}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto animate-fade-up">
            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4">
              <Shield className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-lg font-semibold text-center">
                {renderSafeContent("End-to-End Encrypted")}
              </h2>
              <p className="text-sm text-gray-400 text-center">
                {renderSafeContent("Your files never touch any servers")}
              </p>
            </Card>

            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4">
              <Wifi className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-lg font-semibold text-center">
                {renderSafeContent("Direct P2P Transfer")}
              </h2>
              <p className="text-sm text-gray-400 text-center">
                {renderSafeContent("Secure device-to-device sharing")}
              </p>
            </Card>

            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4">
              <Database className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-lg font-semibold text-center">
                {renderSafeContent("No Storage Limits")}
              </h2>
              <p className="text-sm text-gray-400 text-center">
                {renderSafeContent("Share files of any size")}
              </p>
            </Card>

            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4">
              <Zap className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-lg font-semibold text-center">
                {renderSafeContent("Cross Platform")}
              </h2>
              <p className="text-sm text-gray-400 text-center">
                {renderSafeContent("Works on all devices & browsers")}
              </p>
            </Card>
          </div>

          <Card className="glass-card p-8 max-w-2xl mx-auto space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                {renderSafeContent("Fast, Private File Transfer")}
              </h2>
              <p className="text-muted-foreground">
                {renderSafeContent("Share files securely on your local network without uploading to the cloud")}
              </p>
            </div>

            <Suspense fallback={<div>Loading connection...</div>}>
              <PeerConnection onConnectionChange={handleConnectionChange} />
            </Suspense>
            
            {isConnected && webrtc && (
              <Suspense fallback={<div>Loading file upload...</div>}>
                <FileUpload webrtc={webrtc} />
              </Suspense>
            )}
          </Card>

          <Card className="glass-card p-8 max-w-2xl mx-auto space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                {renderSafeContent("Available Devices")}
              </h2>
              <p className="text-muted-foreground">
                {renderSafeContent("Devices discovered on your network")}
              </p>
            </div>

            <div className="space-y-4">
              {networkDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-dark-accent/50 border border-white/10 hover:border-neon/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-dark-lighter border border-white/10 flex items-center justify-center group-hover:border-neon/30 transition-colors">
                      {getDeviceIcon(device.type)}
                    </div>
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="text-sm text-white/60">{device.peerCode}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyPeerCode(device.peerCode)}
                    className="text-white/60 hover:text-neon"
                  >
                    {copiedCode === device.peerCode ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <div className="text-center space-y-3 text-gray-400 max-w-2xl mx-auto animate-fade-up">
            <h3 className="text-xl font-semibold text-white">
              {renderSafeContent("Privacy by Design")}
            </h3>
            <p>{renderSafeContent("Unlike cloud storage services, your files are transferred directly between devices. No servers, no storage, no tracking - just secure, private sharing.")}</p>
            <p className="text-sm">{renderSafeContent("Works across all platforms and browsers, bringing AirDrop-like functionality to everyone.")}</p>
          </div>
        </main>

        <footer className="py-6 text-center text-sm text-gray-500">
          <a 
            href={sanitizeString("https://the9ines.com")}
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-neon transition-colors"
          >
            {renderSafeContent("the9ines.com productions")}
          </a>
        </footer>
      </div>
    </div>
  );
};

export default Index;
