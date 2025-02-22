
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pause, Play, Square } from "lucide-react";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import { calculateProgress, formatBytes } from "@/services/webrtc/transfer/utils/transfer-utils";

interface TransferProgressBarProps {
  readonly progress: TransferProgress;
  readonly onCancel?: () => void;
  readonly onPause?: () => void;
  readonly onResume?: () => void;
}

export const TransferProgressBar = ({ progress, onCancel, onPause, onResume }: Readonly<TransferProgressBarProps>) => {
  const isPaused = progress.status === 'paused';
  const percent = calculateProgress(progress.loaded, progress.total);
  const bytesTransferred = formatBytes(progress.loaded);
  const totalBytes = formatBytes(progress.total);

  const showControls = progress.status === 'transferring' || progress.status === 'paused';

  return (
    <div className="space-y-2 p-4 border rounded-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex justify-between items-center space-x-4">
        <div className="flex-1 space-y-1">
          <div className="text-sm font-medium">{progress.filename}</div>
          <div className="text-xs text-muted-foreground">
            {bytesTransferred} of {totalBytes} ({percent}%)
          </div>
          <Progress value={percent} className="h-2" />
        </div>
        {showControls && (
          <div className="flex space-x-2">
            {isPaused ? (
              <Button 
                variant="outline" 
                size="icon"
                onClick={onResume}
                title="Resume transfer"
              >
                <Play className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="icon"
                onClick={onPause}
                title="Pause transfer"
              >
                <Pause className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="outline" 
              size="icon"
              onClick={onCancel}
              title="Cancel transfer"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
