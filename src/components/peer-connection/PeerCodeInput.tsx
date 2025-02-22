
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
      <label className="text-sm font-medium leading-none" htmlFor="peer-code">Your Peer Code</label>
      <div className="flex space-x-2">
        <Input
          id="peer-code"
          value={peerCode}
          readOnly
          className="font-mono bg-dark-accent text-neon"
          aria-label="Your peer code"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={onCopy}
          className="shrink-0"
          aria-label={copied ? "Peer code copied" : "Copy peer code"}
        >
          {copied ? (
            <Check className="h-4 w-4 text-neon" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
