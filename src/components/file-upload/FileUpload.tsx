
import { useFileUpload } from "./hooks/useFileUpload";
import { TransferControls } from "./components/TransferControls";
import { Button } from "@/components/ui/button";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { DragDropArea } from "./DragDropArea";
import { FileList } from "./FileList";
import { TransferProgressBar } from "./TransferProgressBar";

interface FileUploadProps {
  readonly webrtc?: WebRTCService;
}

export const FileUpload = ({ webrtc }: FileUploadProps) => {
  const {
    isDragging,
    files,
    progress,
    handleDrag,
    handleDragIn,
    handleDragOut,
    handleDrop,
    handleFiles,
    removeFile,
    handleProgress,
    setFiles,
    setProgress
  } = useFileUpload(webrtc);

  const {
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer
  } = TransferControls({
    webrtc,
    progress,
    files,
    setFiles,
    setProgress,
    onProgressUpdate: handleProgress
  });

  const isTransferActive = progress !== null;
  const hasFiles = files.length > 0;

  return (
    <div className="space-y-4">
      <DragDropArea
        isDragging={isDragging}
        onDragIn={handleDragIn}
        onDragOut={handleDragOut}
        onDrag={handleDrag}
        onDrop={handleDrop}
        onFileSelect={(e) => {
          const selectedFiles = Array.from(e.target.files || []);
          if (selectedFiles.length > 0) {
            handleFiles(selectedFiles);
          }
        }}
      />

      {(hasFiles || isTransferActive) && (
        <div className="space-y-4 animate-fade-up">
          {hasFiles && (
            <FileList 
              files={files} 
              onRemove={removeFile}
              disabled={isTransferActive}
              activeTransfer={progress?.filename}
            />
          )}

          {isTransferActive && progress?.status && (
            <TransferProgressBar
              progress={progress}
              onCancel={cancelTransfer}
              onPause={handlePauseTransfer}
              onResume={handleResumeTransfer}
            />
          )}

          <Button
            onClick={startTransfer}
            className="w-full bg-neon text-black hover:bg-neon/90"
            disabled={isTransferActive}
          >
            Start Transfer
          </Button>
        </div>
      )}
    </div>
  );
};
