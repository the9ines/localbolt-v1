
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
  // When connected, show the remote peer's code (with fallback to target code)
  // When not connected, show the input value for connecting
  const displayValue = isConnected ? (remotePeerCode || targetPeerCode) : targetPeerCode;
  
  return (
    <div className="space-y-2">
      <label 
        htmlFor="target-peer-input"
        className="text-sm font-medium leading-none"
      >
        Connect to Peer
      </label>
      <div className="flex space-x-2">
        <Input
          id="target-peer-input"
          value={displayValue || ""}
          onChange={(e) => !isConnected && onTargetPeerCodeChange(e.target.value.toUpperCase())}
          placeholder="Enter Peer Code"
          className="font-mono bg-dark-accent placeholder:text-white/20"
          maxLength={6}
          disabled={isConnected}
          readOnly={isConnected}
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
