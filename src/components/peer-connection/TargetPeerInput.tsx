
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TargetPeerInputProps {
  targetPeerCode: string;
  onTargetPeerCodeChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect?: () => void;
  isConnected: boolean;
}

export const TargetPeerInput = ({
  targetPeerCode,
  onTargetPeerCodeChange,
  onConnect,
  onDisconnect,
  isConnected
}: TargetPeerInputProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none">
        Connect to Peer
      </label>
      <div className="flex space-x-2">
        <Input
          value={targetPeerCode}
          onChange={(e) => onTargetPeerCodeChange(e.target.value.toUpperCase())}
          placeholder="Enter peer code"
          className="font-mono bg-dark-accent placeholder:text-white/20"
          maxLength={6}
          disabled={isConnected}
        />
        <Button 
          onClick={isConnected ? onDisconnect : onConnect} 
          className="shrink-0 bg-dark-accent text-white hover:bg-neon hover:text-black transition-colors"
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>
    </div>
  );
};
