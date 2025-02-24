
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import WebRTCService from "@/services/webrtc/WebRTCService";

export const useTransferManagement = (
  webrtc: WebRTCService,
  files: File[],
  setFiles: (files: File[]) => void
) => {
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const { toast } = useToast();

  const handleProgress = (transferProgress: TransferProgress) => {
    console.log('[TRANSFER] Progress update in UI:', transferProgress);
    
    if (transferProgress.status === 'error' && !transferProgress.filename) {
      return;
    }

    if (transferProgress.status === 'transferring' && 
        transferProgress.loaded === transferProgress.total && 
        transferProgress.total > 0) {
      setProgress(null);
      toast({
        title: "Transfer complete",
        description: "File transferred successfully"
      });
      return;
    }

    setProgress(transferProgress);

    if (transferProgress.status === 'canceled_by_sender' || 
        transferProgress.status === 'canceled_by_receiver') {
      setProgress(null);
      toast({
        title: "Transfer cancelled",
        description: "The file transfer was cancelled"
      });
    } else if (transferProgress.status === 'error' && transferProgress.filename) {
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

      // Update files array directly instead of using a callback
      setFiles(files.slice(1));
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

  return {
    progress,
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer
  };
};
