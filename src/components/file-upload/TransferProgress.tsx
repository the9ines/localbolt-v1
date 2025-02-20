
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X } from "lucide-react";
import type { TransferProgress as TransferProgressType } from "@/services/webrtc/FileTransferService";

interface TransferProgressProps {
  progress: TransferProgressType;
  onCancel: () => void;
}

export const TransferProgressBar = ({ progress, onCancel }: TransferProgressProps) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="truncate">{progress.filename}</span>
        <span>{Math.round((progress.loaded / progress.total) * 100)}%</span>
      </div>
      <div className="flex space-x-2">
        <Progress 
          value={(progress.currentChunk / progress.totalChunks) * 100}
          className="h-2 bg-dark-accent flex-1"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="text-white/50 hover:text-neon"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
