
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Copy } from "lucide-react";

interface PeerCodeInputProps {
  peerCode: string;
  copied: boolean;
  onCopy: () => void;
}

export function PeerCodeInput({ peerCode, copied, onCopy }: PeerCodeInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="peer-code">Your Peer Code</Label>
      <div className="flex gap-2">
        <Input
          id="peer-code"
          value={peerCode}
          readOnly
          className="font-mono text-center"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={onCopy}
          className="shrink-0"
          title={copied ? "Copied!" : "Copy to clipboard"}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
