
import { useState } from "react";
import { lazy, Suspense } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Shield, Wifi, Database, Zap } from "lucide-react";
import { sanitizeString } from "@/utils/sanitizer";
import WebRTCService from "@/services/webrtc";

const FileUpload = lazy(() => import("@/components/FileUpload"));
const PeerConnection = lazy(() => import("@/components/PeerConnection"));

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);

  const handleConnectionChange = (connected: boolean, service?: WebRTCService) => {
    setIsConnected(connected);
    if (service) {
      setWebrtc(service);
    }
  };

  const renderSafeContent = (content: string) => {
    return sanitizeString(content);
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
