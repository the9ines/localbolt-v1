
import { useState } from "react";
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

  const handlePauseResume = () => {
    if (webrtc && progress) {
      if (progress.status === 'paused') {
        webrtc.resumeTransfer(progress.filename);
        toast({
          title: "Transfer resumed",
          description: `Resumed transfer of ${progress.filename}`,
        });
      } else {
        webrtc.pauseTransfer(progress.filename);
        toast({
          title: "Transfer paused",
          description: `Paused transfer of ${progress.filename}`,
        });
      }
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
      
      setProgress({
        filename: file.name,
        currentChunk: 0,
        totalChunks: Math.ceil(file.size / 16384),
        loaded: 0,
        total: file.size,
        status: 'initializing'
      });

      webrtc.setProgressCallback((transferProgress: TransferProgress) => {
        console.log('[TRANSFER] Progress update in UI:', transferProgress);
        setProgress(transferProgress);

        if (transferProgress.status === 'completed') {
          toast({
            title: "Transfer complete",
            description: `${file.name} has been sent successfully`,
          });
          setFiles(prevFiles => prevFiles.slice(1));
        }
      });

      await webrtc.sendFile(file);
    } catch (error) {
      console.error('Transfer error:', error);
      toast({
        title: "Transfer failed",
        description: `Failed to send file`,
        variant: "destructive",
      });
      setProgress(null);
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
              onPauseResume={handlePauseResume}
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
