
import WebRTCService from "@/services/webrtc/WebRTCService";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useDragDrop } from "@/hooks/use-drag-drop";
import { Button } from "@/components/ui/button";
import { DragDropArea } from "./DragDropArea";
import { FileList } from "./FileList";
import { FileInputButton } from "./FileInputButton";
import { TransferProgressBar } from "./TransferProgress";

interface FileUploadProps {
  webrtc?: WebRTCService;
}

export const FileUpload = ({ webrtc }: FileUploadProps) => {
  const {
    files,
    progress,
    handleFiles,
    removeFile,
    cancelTransfer,
    startTransfer
  } = useFileUpload(webrtc);

  const {
    isDragging,
    handleDrag,
    handleDragIn,
    handleDragOut,
    handleDrop,
    handleFileInput
  } = useDragDrop(handleFiles);

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

      <FileInputButton onFileSelect={handleFileInput} />

      {files.length > 0 && (
        <div className="space-y-4 animate-fade-up">
          <FileList 
            files={files} 
            onRemove={removeFile}
            disabled={progress !== null}
          />

          {progress && (
            <TransferProgressBar
              progress={progress}
              onCancel={cancelTransfer}
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
