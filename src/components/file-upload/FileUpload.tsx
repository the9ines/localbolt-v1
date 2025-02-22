
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc/WebRTCService";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import { DragDropArea } from "./DragDropArea";
import { FileList } from "./FileList";
import { TransferProgressBar } from "./TransferProgress";

interface FileUploadProps {
  webrtc?: WebRTCService;
}

export const FileUpload = ({ webrtc }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

  // Clear progress when WebRTC instance changes (including disconnection)
  useEffect(() => {
    if (!webrtc) {
      setProgress(null);
    }
  }, [webrtc]);

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
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver' || 
        transferProgress.status === 'error') {
      // Clear progress after a delay for error/canceled states
      setTimeout(() => setProgress(null), 3000);
    } else {
      setProgress(transferProgress);
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
      toast({
        title: "Transfer cancelled",
        description: `Cancelled transfer of ${progress.filename}`,
      });
    }
  };

  const startTransfer = async () => {
    if (!webrtc) {
      toast({
        title: "Connection error",
        description: "No peer connection available",
        variant: "destructive",
      });
      return;
    }

    try {
      const file = files[0];
      if (!file) return;

      console.log('Starting transfer for:', file.name);
      
      const CHUNK_SIZE = 16384;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      setProgress({
        filename: file.name,
        currentChunk: 0,
        totalChunks,
        loaded: 0,
        total: file.size,
        status: 'transferring'
      });

      webrtc.setProgressCallback(handleProgress);
      await webrtc.sendFile(file);
      
      console.log('Transfer completed for:', file.name);

      toast({
        title: "Transfer complete",
        description: `${file.name} has been sent successfully`,
      });

      setFiles(prevFiles => prevFiles.slice(1));
    } catch (error) {
      console.error('Transfer error:', error);
      if (error.message === "Transfer cancelled by user") {
        // Already handled by cancelTransfer
      } else {
        toast({
          title: "Transfer failed",
          description: `Failed to send file`,
          variant: "destructive",
        });
      }
    } finally {
      if (!webrtc) {
        setProgress(null);
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

      {files.length > 0 && (
        <div className="space-y-4 animate-fade-up">
          <FileList 
            files={files} 
            onRemove={removeFile}
            disabled={progress !== null}
          />

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
