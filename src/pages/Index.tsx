
import { useState, useEffect, lazy, Suspense } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Shield, Wifi, Database, Zap } from "lucide-react";
import { sanitizeString } from "@/utils/sanitizer";
import WebRTCService from "@/services/webrtc";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const FileUpload = lazy(() => import("@/components/FileUpload"));
const PeerConnection = lazy(() => import("@/components/PeerConnection"));

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", session.user.id)
        .single();
      
      setIsPremium(subscription?.status === "active");
    }
  };

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
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              {renderSafeContent("Secure File Sharing")}
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {renderSafeContent("Direct device-to-device file transfer with end-to-end encryption. No server storage, completely private.")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto animate-fade-up">
            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-3">
              <Wifi className="w-8 h-8 text-neon" />
              <h3 className="text-lg font-semibold">
                {renderSafeContent("Direct Transfer")}
              </h3>
              <p className="text-sm text-gray-400">
                {renderSafeContent("Files transfer directly between devices, never touching external servers.")}
              </p>
            </Card>

            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-3">
              <Shield className="w-8 h-8 text-neon" />
              <h3 className="text-lg font-semibold">
                {renderSafeContent("End-to-End Encrypted")}
              </h3>
              <p className="text-sm text-gray-400">
                {renderSafeContent("All transfers are secured with strong encryption.")}
              </p>
            </Card>

            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-3">
              <Database className="w-8 h-8 text-neon" />
              <h3 className="text-lg font-semibold">
                {renderSafeContent("No Storage")}
              </h3>
              <p className="text-sm text-gray-400">
                {renderSafeContent("Your files are never stored on any servers.")}
              </p>
            </Card>

            <Card className="p-6 bg-dark-accent/50 backdrop-blur-lg border border-white/10 space-y-3">
              <Zap className="w-8 h-8 text-neon" />
              <h3 className="text-lg font-semibold">
                {renderSafeContent("Lightning Fast")}
              </h3>
              <p className="text-sm text-gray-400">
                {renderSafeContent("High-speed transfers using WebRTC technology.")}
              </p>
            </Card>
          </div>

          <Card className="glass-card p-8 max-w-2xl mx-auto space-y-6">
            <Suspense fallback={<div>Loading...</div>}>
              <PeerConnection onConnectionChange={handleConnectionChange} />
              {isConnected && webrtc && <FileUpload webrtc={webrtc} />}
            </Suspense>
          </Card>

          {!isPremium && (
            <Card className="p-6 max-w-2xl mx-auto bg-dark-accent/50 backdrop-blur-lg border border-neon/20 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-neon">
                    Upgrade to Premium
                  </h3>
                  <p className="text-sm text-gray-400">
                    Get unlimited transfers, custom peer IDs, and persistent device pairing
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/subscribe")}
                  className="bg-neon hover:bg-neon/90 text-dark font-medium shrink-0"
                >
                  Upgrade Now
                </Button>
              </div>
            </Card>
          )}

          <div className="text-center space-y-3 text-gray-400 max-w-2xl mx-auto animate-fade-up">
            <p className="text-sm">
              {renderSafeContent("LocalBolt uses WebRTC for direct peer-to-peer connections. All data is encrypted end-to-end and never touches our servers.")}
            </p>
          </div>
        </main>

        <footer className="py-6 text-center text-sm text-gray-500">
          {renderSafeContent("© 2024 LocalBolt. All rights reserved.")}
        </footer>
      </div>
    </div>
  );
};

export default Index;
