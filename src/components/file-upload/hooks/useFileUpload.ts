
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import WebRTCService from "@/services/webrtc/WebRTCService";

export const useFileUpload = (webrtc?: WebRTCService) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

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
    setProgress(transferProgress);
    
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver' || 
        transferProgress.status === 'error') {
      setTimeout(() => setProgress(null), 3000);
    }
  };

  return {
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
  };
};
