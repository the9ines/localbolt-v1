
import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { PeerConnection } from "@/components/PeerConnection";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import WebRTCService from "@/services/webrtc";
import { Shield, Zap, Server, Globe } from "lucide-react";

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
        
        <main className="container mx-auto px-4 py-8 space-y-8 animate-fade-up">
          <Card className="glass-card p-8 max-w-2xl mx-auto space-y-8">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Secure P2P File Transfer
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Like AirDrop, but for everyone. Transfer files instantly with complete privacy - no servers, no storage, just direct peer-to-peer connection.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
              <div className="flex flex-col items-center text-center space-y-2 p-4">
                <Shield className="w-8 h-8 text-neon mb-2" />
                <h3 className="font-semibold">Completely Private</h3>
                <p className="text-sm text-muted-foreground">Direct P2P transfer with no data storage</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-2 p-4">
                <Zap className="w-8 h-8 text-neon mb-2" />
                <h3 className="font-semibold">Lightning Fast</h3>
                <p className="text-sm text-muted-foreground">Instant transfers with no upload waiting</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-2 p-4">
                <Server className="w-8 h-8 text-neon mb-2" />
                <h3 className="font-semibold">No Servers</h3>
                <p className="text-sm text-muted-foreground">Your files never touch a server</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-2 p-4">
                <Globe className="w-8 h-8 text-neon mb-2" />
                <h3 className="font-semibold">Cross Platform</h3>
                <p className="text-sm text-muted-foreground">Works on any device with a browser</p>
              </div>
            </div>

            <PeerConnection onConnectionChange={handleConnectionChange} />
            
            {isConnected && webrtc && (
              <div className="animate-fade-in">
                <FileUpload webrtc={webrtc} />
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Index;
