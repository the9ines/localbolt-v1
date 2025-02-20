
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Smartphone, Wifi, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const NetworkDevices = () => {
  const [deviceName, setDeviceName] = useState("Emerald Fox");
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const handleNameSave = () => {
    setIsEditing(false);
    toast({
      title: "Device name updated",
      description: "Your new device name has been saved",
    });
  };

  return (
    <Card className="glass-card p-8 max-w-2xl mx-auto space-y-12">
      {/* Current Device */}
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="absolute inset-0 bg-neon/20 rounded-full blur-xl animate-pulse" />
          <div className="relative bg-dark-accent border border-neon/20 w-20 h-20 rounded-full mx-auto flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-neon" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xl font-medium text-white">Your Device</p>
          <p className="text-sm text-white/60">Windows • Chrome</p>
        </div>
      </div>

      {/* Network Status */}
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-neon/20 rounded-full blur-xl animate-pulse" />
            <div className="relative bg-dark-accent border border-neon/20 w-16 h-16 rounded-full flex items-center justify-center">
              <Wifi className="w-8 h-8 text-neon" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-white/60 text-center">You are known as:</p>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <div className="flex-1 flex gap-2">
                  <Input
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="bg-dark-accent/50 border-neon/20 text-center"
                    autoFocus
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNameSave}
                    className="border-neon/20 text-neon hover:bg-neon/10"
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-dark-accent/50 border border-neon/20 rounded-md py-2 px-4 text-center">
                    {deviceName}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    className="hover:bg-neon/10"
                  >
                    <Edit2 className="w-4 h-4 text-neon" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-white/60 text-center">Network status:</p>
            <div className="bg-dark-accent/50 border border-neon/20 rounded-md py-2 px-4">
              <p className="text-center text-neon">Connected to local network</p>
            </div>
          </div>
        </div>
      </div>

      {/* Animation Rings */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="absolute border border-neon/5 rounded-full"
            style={{
              width: `${(i + 1) * 160}px`,
              height: `${(i + 1) * 160}px`,
            }}
          />
        ))}
      </div>
    </Card>
  );
};
