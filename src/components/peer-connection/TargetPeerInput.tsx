
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TargetPeerInputProps {
  targetPeerCode: string;
  onTargetPeerCodeChange: (value: string) => void;
  onConnect: () => void;
  isConnected: boolean;
}

export const TargetPeerInput = ({
  targetPeerCode,
  onTargetPeerCodeChange,
  onConnect,
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
          readOnly={isConnected}
        />
        <Button 
          onClick={onConnect}
          variant="outline"
          className={`shrink-0 text-white hover:bg-neon hover:text-black transition-colors ${
            isConnected ? 'hover:bg-neon/90 hover:text-black' : ''
          }`}
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>
    </div>
  );
};
