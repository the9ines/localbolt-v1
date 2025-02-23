
import { useState, useRef } from "react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/sections/Hero";
import { Features } from "@/components/sections/Features";
import { Transfer } from "@/components/sections/Transfer";
import { Footer } from "@/components/sections/Footer";
import WebRTCService from "@/services/webrtc/WebRTCService";

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

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(20,255,106,0.07),rgba(0,0,0,0))] animate-pulse" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(white,transparent_80%)] pointer-events-none" />
      
      <div className="relative z-10">
        <Header />
        
        <main className="container mx-auto px-4 py-16 space-y-20">
          <Hero onStartSharing={scrollToTransfer} />
          <Features />
          <Transfer 
            ref={transferSectionRef}
            onConnectionChange={handleConnectionChange}
            isConnected={isConnected}
            webrtc={webrtc}
          />
          
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

        <Footer />
      </div>
    </div>
  );
};

export default Index;
