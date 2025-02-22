
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import type WebRTCService from "@/services/webrtc/WebRTCService";
import { useToast } from "@/hooks/use-toast";

interface TransferControlsProps {
  readonly webrtc?: WebRTCService;
  readonly progress: TransferProgress | null;
  readonly files: readonly File[];
  readonly setFiles: (files: File[]) => void;
  readonly setProgress: (progress: TransferProgress | null) => void;
  readonly onProgressUpdate: (progress: TransferProgress) => void;
}

export const TransferControls = ({
  webrtc,
  progress,
  files,
  setFiles,
  setProgress,
  onProgressUpdate
}: TransferControlsProps) => {
  const { toast } = useToast();

  const handlePauseTransfer = () => {
    const filename = progress?.filename;
    if (!webrtc || !filename) return;
    webrtc.pauseTransfer(filename);
  };

  const handleResumeTransfer = () => {
    const filename = progress?.filename;
    if (!webrtc || !filename) return;
    webrtc.resumeTransfer(filename);
  };

  const cancelTransfer = () => {
    const filename = progress?.filename;
    if (!webrtc || !filename) return;

    webrtc.cancelTransfer(filename);
    setProgress(null);
    toast({
      title: "Transfer cancelled",
      description: `Cancelled transfer of ${filename}`,
    });
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

    const file = files[0];
    if (!file) return;

    try {
      console.log('Starting transfer for:', file.name);
      
      const CHUNK_SIZE = 16384;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      const initialProgress: TransferProgress = {
        filename: file.name,
        currentChunk: 0,
        totalChunks,
        loaded: 0,
        total: file.size,
        status: 'transferring'
      };
      
      setProgress(initialProgress);
      webrtc.setProgressCallback(onProgressUpdate);
      await webrtc.sendFile(file);
      
      console.log('Transfer completed for:', file.name);
      
      toast({
        title: "Transfer complete",
        description: `${file.name} has been sent successfully`,
      });

      setFiles(files.slice(1));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Transfer error:', errorMessage);
      
      if (errorMessage !== "Transfer cancelled by user") {
        toast({
          title: "Transfer failed",
          description: "Failed to send file",
          variant: "destructive",
        });
      }
    } finally {
      if (!webrtc) {
        setProgress(null);
      }
    }
  };

  return {
    handlePauseTransfer,
    handleResumeTransfer,
    cancelTransfer,
    startTransfer
  };
};
