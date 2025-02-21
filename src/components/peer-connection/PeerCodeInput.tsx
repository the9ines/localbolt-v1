
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface PeerCodeInputProps {
  peerCode: string;
  copied: boolean;
  onCopy: () => void;
}

export const PeerCodeInput = ({ peerCode, copied, onCopy }: PeerCodeInputProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none">Your Peer Code</label>
      <div className="flex space-x-2">
        <Input
          value={peerCode}
          readOnly
          className="font-mono bg-dark-accent text-neon"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={onCopy}
          className="shrink-0 text-white hover:bg-neon hover:text-black transition-colors"
        >
          {copied ? (
            <Check className="h-4 w-4 text-black" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
