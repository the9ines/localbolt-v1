
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TargetPeerInputProps {
  targetPeerCode: string;
  onTargetPeerCodeChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect?: () => void;
  isConnected: boolean;
  remotePeerCode?: string;
}

export const TargetPeerInput = ({
  targetPeerCode,
  onTargetPeerCodeChange,
  onConnect,
  onDisconnect,
  isConnected,
  remotePeerCode
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
          placeholder={remotePeerCode || "Enter Peer Code"}
          className="font-mono bg-dark-accent placeholder:text-white/20"
          maxLength={6}
          disabled={isConnected}
        />
        <Button 
          variant="outline"
          onClick={isConnected ? onDisconnect : onConnect} 
          className="shrink-0 hover:bg-neon hover:text-black transition-colors"
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>
    </div>
  );
};
