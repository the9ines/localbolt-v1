
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const cancelTransfer = () => {
    if (webrtc && progress) {
      console.log('Cancelling transfer for:', progress.filename);
      webrtc.cancelTransfer(progress.filename);
      setProgress({
        ...progress,
        status: 'canceled_by_sender'
      });
    }
  };

  const startTransfer = async () => {
    if (!webrtc) {
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

      webrtc.setProgressCallback((transferProgress: TransferProgress) => {
        console.log('[TRANSFER] Progress update in UI:', transferProgress);
        setProgress(transferProgress);
        
        // Remove the file from the list if transfer is complete or canceled
        if (transferProgress.status && transferProgress.status !== 'transferring') {
          setTimeout(() => {
            setFiles(prevFiles => prevFiles.slice(1));
            setProgress(null);
          }, 3000);
        }
      });

      await webrtc.sendFile(file);
      console.log('Transfer completed for:', file.name);
    } catch (error: any) {
      console.error('Transfer error:', error);
      if (error.message === "Transfer cancelled by user") {
        // Already handled by the progress callback
      } else {
        setProgress(prev => prev ? {
          ...prev,
          status: 'error'
        } : null);
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
