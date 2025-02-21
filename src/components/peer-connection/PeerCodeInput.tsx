
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
      <label className="text-base font-medium leading-none" htmlFor="peerCode">
        Your Peer Code
      </label>
      <div className="flex space-x-2">
        <Input
          id="peerCode"
          value={peerCode}
          readOnly
          className="font-mono bg-dark-accent text-neon text-xl p-4 h-14"
          aria-label="Your peer code"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={onCopy}
          className="h-14 w-14 shrink-0"
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
