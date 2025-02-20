
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Laptop2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ActiveDevice {
  id: string;
  device_name: string;
  peer_code: string;
  last_seen: string;
  network_id: string;
}

interface DeviceDiscoveryProps {
  localPeerCode: string;
  onDeviceSelect: (peerCode: string) => void;
}

export const DeviceDiscovery = ({ localPeerCode, onDeviceSelect }: DeviceDiscoveryProps) => {
  const [devices, setDevices] = useState<ActiveDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const networkId = window.location.hostname; // Simple way to group devices on same network

  // Register device presence
  useEffect(() => {
    const registerDevice = async () => {
      try {
        const deviceName = `LocalBolt - ${navigator.platform}`;
        
        await supabase
          .from('active_devices')
          .upsert({
            device_name: deviceName,
            peer_code: localPeerCode,
            network_id: networkId,
            last_seen: new Date().toISOString()
          }, {
            onConflict: 'peer_code'
          });

        // Update device presence every minute
        const interval = setInterval(async () => {
          await supabase
            .from('active_devices')
            .update({ last_seen: new Date().toISOString() })
            .eq('peer_code', localPeerCode);
        }, 60000);

        return () => {
          clearInterval(interval);
          // Cleanup device on unmount
          supabase
            .from('active_devices')
            .delete()
            .eq('peer_code', localPeerCode);
        };
      } catch (error) {
        console.error('Error registering device:', error);
      }
    };

    registerDevice();
  }, [localPeerCode, networkId]);

  // Subscribe to device changes
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const { data } = await supabase
          .from('active_devices')
          .select('*')
          .eq('network_id', networkId)
          .neq('peer_code', localPeerCode);
        
        if (data) setDevices(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching devices:', error);
        setLoading(false);
      }
    };

    fetchDevices();

    const channel = supabase
      .channel('device_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_devices'
        },
        (payload) => {
          fetchDevices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [localPeerCode, networkId]);

  const handleDeviceSelect = (device: ActiveDevice) => {
    toast({
      title: "Connecting to device...",
      description: `Initiating connection to ${device.device_name}`,
    });
    onDeviceSelect(device.peer_code);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {devices.length === 0 ? (
          "No other devices found on your network"
        ) : (
          `${devices.length} device${devices.length === 1 ? '' : 's'} found on your network`
        )}
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {devices.map((device) => (
          <Card
            key={device.id}
            className="p-4 backdrop-blur-lg border border-white/10 hover:border-neon/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Laptop2 className="h-5 w-5 text-neon" />
                <span className="font-medium">{device.device_name}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeviceSelect(device)}
                className="border-neon text-neon hover:bg-neon hover:text-black"
              >
                Connect
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
