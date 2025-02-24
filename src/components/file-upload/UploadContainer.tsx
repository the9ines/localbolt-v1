
import { DragDropArea } from "./DragDropArea";
import { TransferControls } from "./TransferControls";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { useFileManagement } from "@/hooks/use-file-management";
import { useTransferManagement } from "@/hooks/use-transfer-management";

interface UploadContainerProps {
  webrtc: WebRTCService;
}

export const UploadContainer = ({ webrtc }: UploadContainerProps) => {
  const {
    files,
    setFiles,
    isDragging,
    handleDrag,
    handleDragIn,
    handleDragOut,
    handleDrop,
    handleFileInput,
    removeFile,
  } = useFileManagement();

  const {
    progress,
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer,
  } = useTransferManagement(webrtc, files, setFiles);

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

      <TransferControls
        files={files}
        progress={progress}
        onRemove={removeFile}
        onCancel={cancelTransfer}
        onPause={handlePauseTransfer}
        onResume={handleResumeTransfer}
        onStartTransfer={startTransfer}
      />
    </div>
  );
};
