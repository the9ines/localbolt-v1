
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { TransferProgress } from "@/services/webrtc/types/transfer";
import type WebRTCService from "@/services/webrtc/WebRTCService";

export const useTransferManager = (webrtc?: WebRTCService) => {
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

  const handleProgress = (transferProgress: TransferProgress) => {
    console.log('[TRANSFER] Progress update in UI:', transferProgress);
    setProgress(transferProgress);
    
    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver' || 
        transferProgress.status === 'error') {
      setTimeout(() => setProgress(null), 3000);
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

  const startTransfer = async (file: File) => {
    if (!webrtc) {
      toast({
        title: "Connection error",
        description: "No peer connection available",
        variant: "destructive",
      });
      return false;
    }

    try {
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

      return true;
    } catch (error) {
      console.error('Transfer error:', error);
      if (error.message !== "Transfer cancelled by user") {
        toast({
          title: "Transfer failed",
          description: `Failed to send file`,
          variant: "destructive",
        });
      }
      return false;
    } finally {
      if (!webrtc) {
        setProgress(null);
      }
    }
  };

  return {
    progress,
    setProgress,
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer,
  };
};
