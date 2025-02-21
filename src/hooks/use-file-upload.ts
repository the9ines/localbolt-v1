
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import WebRTCService from "@/services/webrtc/WebRTCService";

export const useFileUpload = (webrtc?: WebRTCService) => {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

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
        status: 'initializing'
      });

      webrtc.setProgressCallback((transferProgress: TransferProgress) => {
        console.log('[TRANSFER] Progress update in UI:', transferProgress);
        setProgress(transferProgress);
      });

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
      setProgress(null);
    }
  };

  return {
    files,
    progress,
    handleFiles,
    removeFile,
    cancelTransfer,
    startTransfer
  };
};
