
import { Button } from "@/components/ui/button";
import type { TransferProgress } from "@/services/webrtc/types/transfer";

interface TransferControlsProps {
  files: File[];
  progress: TransferProgress | null;
  onStartTransfer: () => void;
}

export const TransferControls = ({ 
  files, 
  progress, 
  onStartTransfer 
}: TransferControlsProps) => {
  return (
    <Button
      onClick={onStartTransfer}
      className="w-full bg-neon text-black hover:bg-neon/90"
      disabled={files.length === 0 || progress !== null}
    >
      Start Transfer
    </Button>
  );
};
