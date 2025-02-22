
import { useEffect } from "react";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { DragDropArea } from "./DragDropArea";
import { FileList } from "./FileList";
import { TransferProgressBar } from "./TransferProgress";
import { TransferControls } from "./TransferControls";
import { useFileManager } from "@/hooks/use-file-manager";
import { useTransferManager } from "@/hooks/use-transfer-manager";

interface FileUploadProps {
  webrtc?: WebRTCService;
}

export const FileUpload = ({ webrtc }: FileUploadProps) => {
  const {
    files,
    isDragging,
    handleFiles,
    removeFile,
    removeFirstFile,
    handleDrag,
    handleDragIn,
    handleDragOut,
    handleDrop,
  } = useFileManager();

  const {
    progress,
    setProgress,
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer,
  } = useTransferManager(webrtc);

  useEffect(() => {
    if (!webrtc) {
      setProgress(null);
    }
  }, [webrtc, setProgress]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
  };

  const handleStartTransfer = async () => {
    const file = files[0];
    if (!file) return;
    
    const success = await startTransfer(file);
    if (success) {
      removeFirstFile();
    }
  };

  return (
    <div className="space-y-4">
      <DragDropArea
        isDragging={isDragging}
        onDragIn={handleDragIn}
        onDragOut={handleDragOut}
        onDrag={handleDrag}
        onDrop={handleDrop}
        onFileSelect={handleFileInput}
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

          <TransferControls
            files={files}
            progress={progress}
            onStartTransfer={handleStartTransfer}
          />
        </div>
      )}
    </div>
  );
};
