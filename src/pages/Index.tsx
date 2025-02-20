
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Smartphone, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [deviceName, setDeviceName] = useState("Magenta Hookworm");
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const handleNameChange = () => {
    setIsEditing(false);
    toast({
      title: "Name updated",
      description: "Your device name has been updated successfully",
    });
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Concentric circles background */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/10"
            style={{
              width: `${(i + 1) * 200}px`,
              height: `${(i + 1) * 200}px`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto h-screen flex flex-col items-center justify-center px-4 space-y-32">
        {/* Device Info */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[#4A90E2]">
            <Smartphone className="w-12 h-12" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">Plum Scorpion</h1>
            <p className="text-white/60">iOS iPhone</p>
          </div>
        </div>

        {/* Network Info */}
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[#4A90E2]">
                <Wifi className="w-12 h-12" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-lg">You are known as:</p>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <Input
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      className="bg-white/10 border-0"
                      onBlur={handleNameChange}
                      autoFocus
                    />
                  ) : (
                    <Card className="w-full p-2 bg-white/10 border-0">
                      <p className="text-center">{deviceName}</p>
                    </Card>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(!isEditing)}
                    className="shrink-0"
                  >
                    ✏️
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-lg">You can be discovered:</p>
                <Card className="p-2 bg-[#4A90E2] border-0">
                  <p className="text-center">on this network</p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
