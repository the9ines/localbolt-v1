
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
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onConnect();
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-base font-medium leading-none" htmlFor="targetPeerCode">
        Connect to Peer
      </label>
      <div className="flex space-x-2">
        <Input
          id="targetPeerCode"
          value={targetPeerCode}
          onChange={(e) => onTargetPeerCodeChange(e.target.value.toUpperCase())}
          onKeyPress={handleKeyPress}
          placeholder="Enter peer code"
          className="font-mono bg-dark-accent placeholder:text-white/20 text-xl p-4 h-14"
          maxLength={6}
          aria-label="Enter peer code"
        />
        <Button 
          onClick={onConnect} 
          className="shrink-0 bg-neon text-black hover:bg-neon/90 h-14 px-6 text-lg min-w-[120px]"
        >
          Connect
        </Button>
      </div>
    </div>
  );
};
