
import { useFileUpload } from "./hooks/useFileUpload";
import { TransferControls } from "./components/TransferControls";
import { Button } from "@/components/ui/button";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { DragDropArea } from "./DragDropArea";
import { FileList } from "./FileList";
import { TransferProgressBar } from "./TransferProgress";

interface FileUploadProps {
  webrtc?: WebRTCService;
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

  return (
    <div className="space-y-4">
      <DragDropArea
        isDragging={isDragging}
        onDragIn={handleDragIn}
        onDragOut={handleDragOut}
        onDrag={handleDrag}
        onDrop={handleDrop}
        onFileSelect={(e) => handleFiles(Array.from(e.target.files || []))}
      />

      {(files.length > 0 || progress) && (
        <div className="space-y-4 animate-fade-up">
          {files.length > 0 && (
            <FileList 
              files={files} 
              onRemove={removeFile}
              disabled={progress !== null}
              activeTransfer={progress?.filename}
            />
          )}

          {progress && progress.status && (
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
            disabled={progress !== null}
          >
            Start Transfer
          </Button>
        </div>
      )}
    </div>
  );
};
