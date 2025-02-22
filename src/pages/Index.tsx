
import { useState, useRef } from "react";
import { FileUpload } from "@/components/file-upload/FileUpload";
import { PeerConnection } from "@/components/PeerConnection";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Shield, Wifi, Database, Zap, ArrowRight, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import WebRTCService from "@/services/webrtc/WebRTCService";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => (
  <Card className="group relative overflow-hidden p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 transition-all duration-500 hover:border-neon/50 hover:shadow-[0_8px_30px_rgba(20,255,106,0.15)]">
    <div className="absolute inset-0 bg-gradient-to-br from-neon/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="flex flex-col items-center text-center">
      <Icon className="w-8 h-8 text-neon mb-4 relative z-10 transition-transform duration-500 group-hover:scale-110" />
      <h2 className="text-lg font-semibold mb-2 relative z-10">{title}</h2>
      <p className="text-sm text-gray-400 relative z-10">{description}</p>
    </div>
  </Card>
);

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const transferSectionRef = useRef<HTMLDivElement>(null);

  const handleConnectionChange = (connected: boolean, service?: WebRTCService) => {
    console.log('[UI] Connection change:', connected, !!service);
    setIsConnected(connected);
    if (service) {
      setWebrtc(service);
    }
  };

  const scrollToTransfer = () => {
    transferSectionRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'center'
    });
  };

  const features = [
    {
      icon: Shield,
      title: "End-to-End Encrypted",
      description: "Your files never touch any servers, ensuring complete privacy"
    },
    {
      icon: Wifi,
      title: "Direct P2P Transfer",
      description: "Lightning-fast device-to-device file sharing"
    },
    {
      icon: Database,
      title: "No Storage Limits",
      description: "Transfer files of any size without restrictions"
    },
    {
      icon: Zap,
      title: "Cross Platform",
      description: "Works seamlessly across all devices & browsers"
    }
  ];

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(20,255,106,0.07),rgba(0,0,0,0))] animate-pulse" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(white,transparent_80%)] pointer-events-none" />
      
      <div className="relative z-10">
        <Header />
        
        <main className="container mx-auto px-4 py-16 space-y-20">
          <div className="text-center space-y-6 animate-fade-up max-w-3xl mx-auto">
            <div className="inline-flex items-center px-3 py-1 rounded-full border border-neon/20 bg-neon/5 text-neon text-sm mb-4">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-neon"></span>
              </span>
              Secure File Transfer
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
              Private, Server-Free File Sharing
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Like AirDrop, but for everyone. Transfer files directly between devices with military-grade encryption. No servers, no storage, no limits.
            </p>
            <Button 
              size="lg" 
              className="bg-neon text-black hover:bg-neon/90 hover:scale-105 transition-all duration-300"
              onClick={scrollToTransfer}
            >
              Start Sharing <ArrowRight className="ml-2" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-up">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>

          <Card 
            ref={transferSectionRef}
            className="relative overflow-hidden p-8 max-w-3xl mx-auto space-y-6 bg-dark-accent/30 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)] animate-fade-up"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-neon/5 via-transparent to-transparent opacity-50" />
            
            <div className="relative space-y-4 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Fast, Private File Transfer
              </h2>
              <p className="text-muted-foreground">
                Share files securely on your local network without uploading to the cloud
              </p>
            </div>

            <div className="relative">
              <PeerConnection onConnectionChange={handleConnectionChange} />
              
              {isConnected && webrtc && (
                <div className="animate-fade-in mt-6">
                  <FileUpload webrtc={webrtc} />
                </div>
              )}
            </div>
          </Card>

          <div className="text-center space-y-4 max-w-2xl mx-auto animate-fade-up pb-12">
            <h3 className="text-xl font-semibold text-white">Privacy by Design</h3>
            <p className="text-gray-400 leading-relaxed">
              Unlike cloud storage services, your files are transferred directly between devices. 
              No servers, no storage, no tracking - just secure, private sharing.
            </p>
            <p className="text-sm text-gray-500">
              Works across all platforms and browsers, bringing AirDrop-like functionality to everyone.
            </p>
          </div>
        </main>

        <footer className="py-8 text-center text-sm text-gray-500 border-t border-white/5">
          <a 
            href="https://the9ines.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-neon transition-colors inline-flex items-center gap-1"
          >
            <Zap className="w-4 h-4" />
            the9ines.com productions
          </a>
        </footer>
      </div>
    </div>
  );
};

export default Index;
