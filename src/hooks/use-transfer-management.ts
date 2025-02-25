
import { useState, useCallback, useRef, useEffect } from "react";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { useToast } from "@/hooks/use-toast";

export const useTransferManagement = (
  webrtc: WebRTCService,
  files: File[],
  setFiles: (files: File[]) => void
) => {
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const lastStatus = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (progress) {
      console.log('[TRANSFER-UI] Progress state updated:', {
        filename: progress.filename,
        status: progress.status,
        loaded: progress.loaded,
        total: progress.total,
        currentChunk: progress.currentChunk,
        totalChunks: progress.totalChunks
      });
    }
  }, [progress]);

  const resetTransfer = useCallback(() => {
    console.log('[TRANSFER-UI] Resetting transfer state');
    setProgress(null);
    lastStatus.current = null;
  }, []);

  const handleProgress = useCallback((transferProgress: TransferProgress) => {
    console.log('[TRANSFER-UI] Received progress update:', transferProgress);
    
    if (!transferProgress || !transferProgress.filename) {
      console.log('[TRANSFER-UI] Ignoring invalid progress update');
      return;
    }

    requestAnimationFrame(() => {
      setProgress(prevProgress => {
        if (!prevProgress || prevProgress.filename !== transferProgress.filename) {
          console.log('[TRANSFER-UI] New transfer detected, updating state');
          return transferProgress;
        }

        if (transferProgress.status === 'transferring' && 
            transferProgress.loaded === transferProgress.total && 
            transferProgress.total > 0) {
          console.log('[TRANSFER-UI] Transfer complete');
          toast({
            title: "Transfer Complete",
            description: `Successfully transferred ${transferProgress.filename}`,
          });
          return null;
        }

        if (transferProgress.status === 'canceled_by_sender' || 
            transferProgress.status === 'canceled_by_receiver') {
          console.log('[TRANSFER-UI] Transfer canceled');
          toast({
            title: "Transfer Canceled",
            description: `Transfer of ${transferProgress.filename} was canceled`,
            variant: "destructive",
          });
          return null;
        }

        if (transferProgress.status === 'error') {
          console.log('[TRANSFER-UI] Transfer error');
          toast({
            title: "Transfer Error",
            description: `Error transferring ${transferProgress.filename}`,
            variant: "destructive",
          });
          return null;
        }

        console.log('[TRANSFER-UI] Updating progress state:', transferProgress);
        
        if (prevProgress.status === 'paused' && transferProgress.status === 'transferring') {
          return { ...transferProgress, status: 'paused' };
        }
        
        return transferProgress;
      });
    });
    
    lastStatus.current = transferProgress.status;
  }, [toast]);

  const handlePauseTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      console.log('[TRANSFER-UI] Pausing transfer:', progress.filename);
      webrtc.pauseTransfer(progress.filename);
      setProgress(prev => prev ? { ...prev, status: 'paused' } : null);
    }
  }, [webrtc, progress]);

  const handleResumeTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      console.log('[TRANSFER-UI] Resuming transfer:', progress.filename);
      webrtc.resumeTransfer(progress.filename);
      setProgress(prev => prev ? { ...prev, status: 'transferring' } : null);
    }
  }, [webrtc, progress]);

  const cancelTransfer = useCallback(() => {
    if (webrtc && progress?.filename) {
      console.log('[TRANSFER-UI] Canceling transfer:', progress.filename);
      webrtc.cancelTransfer(progress.filename);
      resetTransfer();
    }
  }, [webrtc, progress, resetTransfer]);

  const startTransfer = useCallback(async () => {
    if (!webrtc || !files.length) {
      console.log('[TRANSFER-UI] Cannot start transfer - no WebRTC or files');
      return;
    }

    if (progress) {
      console.log('[TRANSFER-UI] Canceling current transfer before starting new one');
      await cancelTransfer();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const file = files[0];
      console.log('[TRANSFER-UI] Starting transfer for:', file.name);
      
      resetTransfer();
      
      webrtc.setProgressCallback(handleProgress);
      
      handleProgress({
        status: 'transferring',
        filename: file.name,
        currentChunk: 0,
        totalChunks: 0,
        loaded: 0,
        total: file.size,
        timestamp: Date.now()
      });
      
      await webrtc.sendFile(file);
      setFiles(files.filter((_, index) => index !== 0));
      
      console.log('[TRANSFER-UI] Transfer completed for:', file.name);
      
      toast({
        title: "Transfer Complete",
        description: `Successfully transferred ${file.name}`,
      });
    } catch (error) {
      console.error('[TRANSFER-UI] Transfer error:', error);
      
      if (error.message === "Transfer cancelled by user") {
        return;
      }
      
      toast({
        title: "Transfer Error",
        description: error.message || "Failed to transfer file",
        variant: "destructive",
      });
      
      resetTransfer();
    }
  }, [webrtc, files, progress, cancelTransfer, handleProgress, resetTransfer, setFiles, toast]);

  return {
    progress,
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer
  };
};
