
import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { PeerConnection } from "@/components/PeerConnection";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);

  return (
    <div className="min-h-screen bg-dark text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.1),rgba(0,0,0,0))]" />
      
      <div className="relative z-10">
        <Header />
        
        <main className="container mx-auto px-4 py-8 space-y-8 animate-fade-up">
          <Card className="glass-card p-8 max-w-2xl mx-auto space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Quick File Transfer
              </h2>
              <p className="text-muted-foreground">
                Share files instantly with peers on your local network
              </p>
            </div>

            <PeerConnection onConnectionChange={setIsConnected} />
            
            {isConnected && (
              <div className="animate-fade-in">
                <FileUpload />
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Index;
