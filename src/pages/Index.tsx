
import { useState } from "react";
import { FileUpload } from "@/components/file-upload/FileUpload";
import { PeerConnection } from "@/components/PeerConnection";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { Shield, Wifi, Database, Zap } from "lucide-react";

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);

  const handleConnectionChange = (connected: boolean, service?: WebRTCService) => {
    setIsConnected(connected);
    if (service) {
      setWebrtc(service);
    }
  };

  return (
    <div className="min-h-screen bg-dark text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.1),rgba(0,0,0,0))]" />
      
      <div className="relative z-10">
        <Header />
        
        <main className="container mx-auto px-4 py-8 space-y-8">
          <div className="text-center space-y-4 animate-fade-up">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Private, Server-Free File Sharing
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Like AirDrop, but for everyone. Transfer files directly between devices with end-to-end encryption.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto animate-fade-up">
            <Card className="p-4 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-3">
              <Shield className="w-6 h-6 text-neon mx-auto" />
              <h2 className="text-base font-semibold text-center">End-to-End Encrypted</h2>
              <p className="text-sm text-gray-400 text-center">Your files never touch servers</p>
            </Card>

            <Card className="p-4 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-3">
              <Wifi className="w-6 h-6 text-neon mx-auto" />
              <h2 className="text-base font-semibold text-center">Direct P2P Transfer</h2>
              <p className="text-sm text-gray-400 text-center">Device-to-device sharing</p>
            </Card>

            <Card className="p-4 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-3">
              <Database className="w-6 h-6 text-neon mx-auto" />
              <h2 className="text-base font-semibold text-center">No Storage Limits</h2>
              <p className="text-sm text-gray-400 text-center">Share files of any size</p>
            </Card>

            <Card className="p-4 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-3">
              <Zap className="w-6 h-6 text-neon mx-auto" />
              <h2 className="text-base font-semibold text-center">Cross Platform</h2>
              <p className="text-sm text-gray-400 text-center">All devices & browsers</p>
            </Card>
          </div>

          <Card className="glass-card p-6 max-w-2xl mx-auto space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Fast, Private File Transfer
              </h2>
              <p className="text-muted-foreground">
                Share files securely without uploading to the cloud
              </p>
            </div>

            <PeerConnection onConnectionChange={handleConnectionChange} />
            
            {isConnected && webrtc && (
              <div className="animate-fade-in">
                <FileUpload webrtc={webrtc} />
              </div>
            )}
          </Card>
        </main>

        <footer className="py-6 text-center text-sm text-gray-500">
          <a 
            href="https://the9ines.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-neon transition-colors p-2"
          >
            the9ines.com productions
          </a>
        </footer>
      </div>
    </div>
  );
};

export default Index;
