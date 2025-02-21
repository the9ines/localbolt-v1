
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TargetPeerInputProps {
  targetPeerCode: string;
  onTargetPeerCodeChange: (value: string) => void;
  onConnect: () => void;
}

export const TargetPeerInput = ({
  targetPeerCode,
  onTargetPeerCodeChange,
  onConnect
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
          className="font-mono bg-dark-accent placeholder:text-white/20 text-lg p-4 min-h-[48px]"
          maxLength={6}
          tabIndex={0}
          aria-label="Enter peer code"
        />
        <Button 
          onClick={onConnect} 
          className="shrink-0 bg-neon text-black hover:bg-neon/90 min-h-[48px] px-6 text-lg"
          tabIndex={0}
        >
          Connect
        </Button>
      </div>
    </div>
  );
};
