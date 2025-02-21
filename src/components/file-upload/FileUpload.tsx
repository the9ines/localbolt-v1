
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import WebRTCService from "@/services/webrtc/WebRTCService";
import type { TransferProgress } from "@/services/webrtc/FileTransferService";
import { DragDropArea } from "./DragDropArea";
import { FileList } from "./FileList";
import { TransferProgressBar } from "./TransferProgress";
import { Camera, Image } from "lucide-react";

interface FileUploadProps {
  webrtc?: WebRTCService;
}

export const FileUpload = ({ webrtc }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [hasMediaPermissions, setHasMediaPermissions] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkMediaPermissions();
  }, []);

  const checkMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setHasMediaPermissions(true);
    } catch (error) {
      console.log('Media permissions not granted:', error);
      setHasMediaPermissions(false);
    }
  };

  const requestMediaAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      toast({
        title: "Access granted",
        description: "You can now upload media from your device",
      });
      setHasMediaPermissions(true);
    } catch (error) {
      toast({
        title: "Permission denied",
        description: "Please allow access to your camera to upload media",
        variant: "destructive",
      });
    }
  };

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

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(videoTrack);
      
      const blob = await imageCapture.takePhoto();
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      handleFiles([file]);
      
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      toast({
        title: "Camera error",
        description: "Failed to capture image from camera",
        variant: "destructive",
      });
    }
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
        total: file.size
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

  return (
    <div className="space-y-4">
      {!hasMediaPermissions && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-500 mb-2">
            Allow access to your camera and files to enable media sharing
          </p>
          <Button
            onClick={requestMediaAccess}
            variant="outline"
            className="bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30"
          >
            <Camera className="w-4 h-4 mr-2" />
            Allow Access
          </Button>
        </div>
      )}

      <DragDropArea
        isDragging={isDragging}
        onDragIn={handleDragIn}
        onDragOut={handleDragOut}
        onDrag={handleDrag}
        onDrop={handleDrop}
        onFileSelect={handleFileInput}
      />

      {hasMediaPermissions && (
        <div className="flex gap-2">
          <Button
            onClick={handleCameraCapture}
            variant="outline"
            className="flex-1"
          >
            <Camera className="w-4 h-4 mr-2" />
            Capture Photo
          </Button>
          <Button
            onClick={() => document.getElementById('gallery-input')?.click()}
            variant="outline"
            className="flex-1"
          >
            <Image className="w-4 h-4 mr-2" />
            Choose from Gallery
          </Button>
          <input
            type="file"
            id="gallery-input"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

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
