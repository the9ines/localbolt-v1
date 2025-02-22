
import { useState, Suspense, lazy } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Shield, Wifi, Database, Zap } from "lucide-react";
import WebRTCService from "@/services/webrtc/WebRTCService";

// Lazy load components that are not immediately visible
const FileUpload = lazy(() => import("@/components/file-upload/FileUpload"));
const PeerConnection = lazy(() => import("@/components/PeerConnection"));

// Loading fallback component
const LoadingFallback = () => (
  <div className="animate-pulse p-8 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-neon border-t-transparent rounded-full animate-spin" />
  </div>
);

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
          <div className="text-center space-y-4 animate-fade-up">
            <h1 className="text-5xl font-bold tracking-tight">
              Private, Server-Free File Sharing
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Like AirDrop, but for everyone. Transfer files directly between devices with end-to-end encryption. No servers, no storage, no limits.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto animate-fade-up">
            <Card className="p-4 md:p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(20,255,106,0.1)] transition-shadow duration-300">
              <Shield className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-base md:text-lg font-semibold text-center">End-to-End Encrypted</h2>
              <p className="text-xs md:text-sm text-gray-400 text-center">Your files never touch any servers</p>
            </Card>

            <Card className="p-4 md:p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(20,255,106,0.1)] transition-shadow duration-300">
              <Wifi className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-base md:text-lg font-semibold text-center">Direct P2P Transfer</h2>
              <p className="text-xs md:text-sm text-gray-400 text-center">Secure device-to-device sharing</p>
            </Card>

            <Card className="p-4 md:p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(20,255,106,0.1)] transition-shadow duration-300">
              <Database className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-base md:text-lg font-semibold text-center">No Storage Limits</h2>
              <p className="text-xs md:text-sm text-gray-400 text-center">Share files of any size</p>
            </Card>

            <Card className="p-4 md:p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(20,255,106,0.1)] transition-shadow duration-300">
              <Zap className="w-8 h-8 text-neon mx-auto" />
              <h2 className="text-base md:text-lg font-semibold text-center">Cross Platform</h2>
              <p className="text-xs md:text-sm text-gray-400 text-center">Works on all devices & browsers</p>
            </Card>
          </div>

          <Card className="glass-card p-8 max-w-2xl mx-auto space-y-6 shadow-[0_15px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.7)] transition-shadow duration-300">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Fast, Private File Transfer
              </h2>
              <p className="text-muted-foreground">
                Share files securely on your local network without uploading to the cloud
              </p>
            </div>

            <Suspense fallback={<LoadingFallback />}>
              <PeerConnection onConnectionChange={handleConnectionChange} />
            </Suspense>
            
            {isConnected && webrtc && (
              <div className="animate-fade-in">
                <Suspense fallback={<LoadingFallback />}>
                  <FileUpload webrtc={webrtc} />
                </Suspense>
              </div>
            )}
          </Card>

          <div className="text-center space-y-3 text-gray-400 max-w-2xl mx-auto animate-fade-up">
            <h3 className="text-xl font-semibold text-white">Privacy by Design</h3>
            <p>Unlike cloud storage services, your files are transferred directly between devices. No servers, no storage, no tracking - just secure, private sharing.</p>
            <p className="text-sm">Works across all platforms and browsers, bringing AirDrop-like functionality to everyone.</p>
          </div>
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
