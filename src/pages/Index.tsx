
import { useState, useRef } from "react";
import { Helmet } from "react-helmet";
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
    console.log('[INDEX] Connection change:', connected, !!service);
    setIsConnected(connected);
    if (service) {
      setWebrtc(service);
      // Ensure the service has a connection state handler
      service.setConnectionStateHandler((state) => {
        console.log('[INDEX] WebRTC connection state:', state);
        setIsConnected(state === 'connected');
      });
    } else if (!connected) {
      setWebrtc(null);
    }
  };

  const scrollToTransfer = () => {
    transferSectionRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'center'
    });
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "LocalBolt",
    "applicationCategory": "File Transfer",
    "operatingSystem": "Cross-platform",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": "Secure, private, peer-to-peer file transfer with end-to-end encryption. Transfer files directly between devices without cloud storage or servers.",
    "featureList": [
      "End-to-end encryption",
      "Direct peer-to-peer transfer",
      "No server storage",
      "Cross-platform compatibility",
      "No file size limits",
      "Instant file sharing",
      "Privacy focused"
    ]
  };

  return (
    <>
      <Helmet>
        <title>LocalBolt - Secure P2P File Transfer | Better than AirDrop for All Devices</title>
        <meta name="description" content="Transfer files securely between devices with end-to-end encryption. No servers, no storage, no tracking. Like AirDrop but works everywhere - the fastest and most secure way to share files peer-to-peer." />
        <meta name="keywords" content="p2p file transfer, secure file sharing, end-to-end encrypted, airdrop alternative, peer to peer file sharing, cross platform file transfer" />
        
        {/* Open Graph / Social Media */}
        <meta property="og:title" content="LocalBolt - Secure P2P File Transfer" />
        <meta property="og:description" content="Transfer files securely between devices with end-to-end encryption. No servers, no storage, no tracking. Like AirDrop but works everywhere." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://localbolt.site" />
        <meta property="og:image" content="https://localbolt.site/og-image.png" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="LocalBolt - Secure P2P File Transfer" />
        <meta name="twitter:description" content="Transfer files securely between devices with end-to-end encryption. No servers, no storage, no tracking." />
        <meta name="twitter:image" content="https://localbolt.site/og-image.png" />
        
        {/* Additional SEO Meta Tags */}
        <meta name="robots" content="index, follow" />
        <meta name="canonical" content="https://localbolt.site" />
        <link rel="canonical" href="https://localbolt.site" />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-dark text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(20,255,106,0.07),rgba(0,0,0,0))] animate-pulse" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(white,transparent_80%)] pointer-events-none" />
        
        <div className="relative z-10">
          <Header />
          
          <main className="container mx-auto px-4 py-16 space-y-16">
            <Hero onStartSharing={scrollToTransfer} />
            <Features />
            <Transfer 
              ref={transferSectionRef}
              onConnectionChange={handleConnectionChange}
              isConnected={isConnected}
              webrtc={webrtc}
            />
            
            <section aria-label="Privacy Information" className="text-center space-y-4 max-w-2xl mx-auto animate-fade-up pb-6">
              <h3 className="text-xl font-semibold text-white">Privacy by Design</h3>
              <p className="text-gray-400 leading-relaxed">
                Unlike cloud storage services, your files are transferred directly between devices. No servers, no storage, no tracking - just secure, private sharing.
              </p>
              <p className="text-sm text-gray-500">
                Works across all platforms and browsers, bringing AirDrop-like functionality to everyone.
              </p>
            </section>

            <div className="flex justify-center items-center pb-4">
              <a 
                href="https://github.com/the9ines/localbolt-v1" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center opacity-70 hover:opacity-100 transition-all group"
              >
                <img 
                  src="/lovable-uploads/09f73644-2960-492d-a0ac-1102840edc69.png" 
                  alt="GitHub Repository for LocalBolt"
                  className="w-6 h-6 transition-all group-hover:drop-shadow-[0_0_3px_rgba(20,255,106,0.7)]"
                />
              </a>
            </div>
          </main>

          <Footer />
        </div>
      </div>
    </>
  );
};

export default Index;
