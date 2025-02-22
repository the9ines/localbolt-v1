
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";

interface PeerCodeInputProps {
  peerCode: string;
  copied: boolean;
  onCopy: () => void;
}

export const PeerCodeInput = ({ peerCode, copied, onCopy }: PeerCodeInputProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="peer-code">Your Peer Code</Label>
      <div className="flex space-x-2">
        <Input
          id="peer-code"
          value={peerCode}
          readOnly
          className="font-mono bg-dark-accent text-neon text-center"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={onCopy}
          className="shrink-0"
          title={copied ? "Copied!" : "Copy to clipboard"}
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
