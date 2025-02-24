
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { DragDropArea } from "./DragDropArea";
import { FileList } from "./FileList";
import { TransferProgressBar } from "./TransferProgress";
import { Button } from "@/components/ui/button";
import WebRTCService from "@/services/webrtc/WebRTCService";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";

interface UploadContainerProps {
  webrtc: WebRTCService;
}

export const UploadContainer = ({ webrtc }: UploadContainerProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
  };

  const handleFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    toast({
      title: "Files added",
      description: `${newFiles.length} file(s) ready to transfer`,
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProgress = (transferProgress: TransferProgress) => {
    console.log('[TRANSFER] Progress update in UI:', transferProgress);
    
    // Ignore empty error states that come after successful completion
    if (transferProgress.status === 'error' && 
        !transferProgress.filename && 
        transferProgress.loaded === 0 && 
        transferProgress.total === 0) {
      return;
    }
    
    setProgress(transferProgress);
    
    // Check for successful transfer completion
    if (transferProgress.loaded === transferProgress.total && transferProgress.total > 0) {
      console.log('[TRANSFER] Transfer completed successfully');
      setProgress(null);
      toast({
        title: "Transfer complete",
        description: "File downloaded successfully"
      });
      return;
    }
    
    // Handle error cases
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver') {
      setProgress(null);
      toast({
        title: "Transfer cancelled",
        description: "The file transfer was cancelled"
      });
    } else if (transferProgress.status === 'error' && transferProgress.filename) {
      // Only show error toast for actual file transfer errors
      setProgress(null);
      toast({
        title: "Transfer error",
        description: "An error occurred during the transfer",
        variant: "destructive"
      });
    }
  };

  const handlePauseTransfer = () => {
    if (webrtc && progress) {
      webrtc.pauseTransfer(progress.filename);
    }
  };

  const handleResumeTransfer = () => {
    if (webrtc && progress) {
      webrtc.resumeTransfer(progress.filename);
    }
  };

  const cancelTransfer = () => {
    if (webrtc && progress) {
      webrtc.cancelTransfer(progress.filename);
      setProgress(null);
    }
  };

  const startTransfer = async () => {
    if (!webrtc) {
      toast({
        title: "Connection error",
        description: "No peer connection available",
        variant: "destructive"
      });
      return;
    }

    try {
      const file = files[0];
      if (!file) return;
      
      console.log('Starting transfer for:', file.name);
      
      webrtc.setProgressCallback(handleProgress);
      await webrtc.sendFile(file);
      
      console.log('Transfer completed for:', file.name);
      
      toast({
        title: "Transfer complete",
        description: `${file.name} has been sent successfully`
      });

      setFiles(prevFiles => prevFiles.slice(1));
    } catch (error) {
      console.error('Transfer error:', error);
      if (error.message !== "Transfer cancelled by user") {
        toast({
          title: "Transfer failed",
          description: "Failed to send file",
          variant: "destructive"
        });
      }
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
