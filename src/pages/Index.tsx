
import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { PeerConnection } from "@/components/PeerConnection";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import WebRTCService from "@/services/webrtc";
import { Shield, Wifi, Database } from "lucide-react";

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
    <div className="min-h-screen bg-dark text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.1),rgba(0,0,0,0))]" />
      
      <div className="relative z-10">
        <Header />
        
        <main className="container mx-auto px-4 py-12 space-y-12">
          <div className="text-center space-y-4 animate-fade-up">
            <h1 className="text-5xl font-bold tracking-tight">
              Welcome to LocalBolt
            </h1>
            <p className="text-xl text-gray-400">
              Secure, private file sharing without limits
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto animate-fade-up">
            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4">
              <Shield className="w-12 h-12 text-neon mx-auto" />
              <h2 className="text-xl font-semibold text-center">End-to-End Encrypted</h2>
              <p className="text-gray-400 text-center">Your files never touch our servers</p>
            </Card>

            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4">
              <Wifi className="w-12 h-12 text-neon mx-auto" />
              <h2 className="text-xl font-semibold text-center">Direct P2P Transfer</h2>
              <p className="text-gray-400 text-center">Lightning-fast local sharing</p>
            </Card>

            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4">
              <Database className="w-12 h-12 text-neon mx-auto" />
              <h2 className="text-xl font-semibold text-center">No Size Limits</h2>
              <p className="text-gray-400 text-center">Share files of any size</p>
            </Card>
          </div>

          <Card className="max-w-2xl mx-auto p-8 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-8 animate-fade-up">
            <PeerConnection onConnectionChange={handleConnectionChange} />
            
            {isConnected && webrtc && (
              <div className="animate-fade-in">
                <FileUpload webrtc={webrtc} />
              </div>
            )}
          </Card>

          <div className="text-center space-y-2 text-gray-400 animate-fade-up">
            <p className="text-lg">Like AirDrop, but for everyone. No installation needed.</p>
            <p>Works across all platforms and browsers.</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
