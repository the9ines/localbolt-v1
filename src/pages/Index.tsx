
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
    console.log('[UI] Connection change:', connected, !!service);
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
        
        <main className="container mx-auto px-4 py-12 space-y-12">
          <section className="text-center space-y-4 animate-fade-up">
            <h1 className="text-5xl font-bold tracking-tight">
              Secure P2P File Sharing Without Servers
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Transfer files directly between devices with end-to-end encryption. Like AirDrop, but for everyone - no login, no storage limits, no servers required.
            </p>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto animate-fade-up">
            <Card className="p-4 md:p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(20,255,106,0.1)] transition-shadow duration-300">
              <Shield className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-base md:text-lg font-semibold text-center">End-to-End Encryption</h2>
              <p className="text-xs md:text-sm text-gray-400 text-center">Military-grade encryption for your files</p>
            </Card>

            <Card className="p-4 md:p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(20,255,106,0.1)] transition-shadow duration-300">
              <Wifi className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-base md:text-lg font-semibold text-center">Direct P2P Transfer</h2>
              <p className="text-xs md:text-sm text-gray-400 text-center">Fast, direct device-to-device sharing</p>
            </Card>

            <Card className="p-4 md:p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(20,255,106,0.1)] transition-shadow duration-300">
              <Database className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-base md:text-lg font-semibold text-center">Unlimited File Size</h2>
              <p className="text-xs md:text-sm text-gray-400 text-center">No restrictions on file sizes</p>
            </Card>

            <Card className="p-4 md:p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(20,255,106,0.1)] transition-shadow duration-300">
              <Zap className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-base md:text-lg font-semibold text-center">Universal Compatibility</h2>
              <p className="text-xs md:text-sm text-gray-400 text-center">Works on all modern browsers</p>
            </Card>
          </section>

          <section className="glass-card p-8 max-w-2xl mx-auto space-y-6 shadow-[0_15px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.7)] transition-shadow duration-300">
            <div className="space-y-2 text-center">
              <h3 className="text-2xl font-semibold tracking-tight">
                Start Secure File Transfer
              </h3>
              <p className="text-muted-foreground">
                Connect with another device to begin sharing files securely
              </p>
            </div>

            <PeerConnection onConnectionChange={handleConnectionChange} />
            
            {isConnected && webrtc && (
              <div className="animate-fade-in">
                <FileUpload webrtc={webrtc} />
              </div>
            )}
          </section>

          <section className="text-center space-y-3 text-gray-400 max-w-2xl mx-auto animate-fade-up">
            <h4 className="text-xl font-semibold text-white">Privacy-First Design</h4>
            <p>Your files never touch our servers. Everything is transferred directly between devices using peer-to-peer technology, ensuring maximum privacy and security.</p>
            <p className="text-sm">Experience AirDrop-like functionality on any device with a modern web browser.</p>
          </section>
        </main>

        <footer className="py-6 text-center text-sm text-gray-500">
          <a 
            href="https://the9ines.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-neon transition-colors"
          >
            the9ines.com productions
          </a>
        </footer>
      </div>
    </div>
  );
};

export default Index;
