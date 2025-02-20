
import { useState, useCallback } from 'react';
import { TransferProgress } from '@/services/webrtc/FileTransferService';
import WebRTCService from '@/services/webrtc/WebRTCService';

export const useTransferProgress = (webrtc: WebRTCService | null) => {
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);

  const handleProgress = useCallback((progress: TransferProgress) => {
    setTransferProgress(progress);
    
    if (progress.status && progress.status !== 'transferring') {
      setTimeout(() => setTransferProgress(null), 3000);
    }
  }, []);

  const handleCancelReceiving = useCallback(() => {
    if (webrtc && transferProgress) {
      webrtc.cancelTransfer(transferProgress.filename, true);
    }
  }, [webrtc, transferProgress]);

  return {
    transferProgress,
    handleProgress,
    handleCancelReceiving
  };
};
