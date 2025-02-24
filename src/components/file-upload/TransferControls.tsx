
import { Button } from "@/components/ui/button";
import { TransferProgressBar } from "./TransferProgress";
import { FileList } from "./FileList";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";

interface TransferControlsProps {
  files: File[];
  progress: TransferProgress | null;
  onRemove: (index: number) => void;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  onStartTransfer: () => void;
}

export const TransferControls = ({
  files,
  progress,
  onRemove,
  onCancel,
  onPause,
  onResume,
  onStartTransfer,
}: TransferControlsProps) => {
  if (!files.length && !progress) return null;

  return (
    <div className="space-y-4 animate-fade-up">
      {files.length > 0 && (
        <FileList 
          files={files} 
          onRemove={onRemove}
          disabled={progress !== null}
          activeTransfer={progress?.filename}
        />
      )}

      {progress && progress.status && (
        <TransferProgressBar
          progress={progress}
          onCancel={onCancel}
          onPause={onPause}
          onResume={onResume}
        />
      )}

      <Button
        onClick={onStartTransfer}
        className="w-full bg-neon text-black hover:bg-neon/90"
        disabled={progress !== null}
      >
        Start Transfer
      </Button>
    </div>
  );
};
