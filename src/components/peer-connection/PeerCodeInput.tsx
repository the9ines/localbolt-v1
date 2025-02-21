
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
          className="font-mono bg-dark-accent text-neon text-lg p-4 min-h-[48px]"
          tabIndex={0}
          aria-label="Your peer code"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={onCopy}
          className="shrink-0 min-h-[48px] min-w-[48px]"
          tabIndex={0}
          aria-label={copied ? "Code copied" : "Copy code"}
        >
          {copied ? (
            <Check className="h-6 w-6 text-neon" />
          ) : (
            <Copy className="h-6 w-6" />
          )}
        </Button>
      </div>
    </div>
  );
};
