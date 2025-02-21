
import { useCallback, useEffect, useState } from "react";
import { DragDropArea } from "./DragDropArea";
import { FileList } from "./FileList";
import WebRTCService from "@/services/webrtc/WebRTCService";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  webrtc: WebRTCService;
}

export const FileUpload = ({ webrtc }: FileUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const onDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.items) {
      const newFiles = Array.from(e.dataTransfer.items)
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null);
      
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
    } else {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
    }
  }, []);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
    }
  }, []);

  const handleSendFile = async (file: File) => {
    try {
      await webrtc.sendFile(file);
      toast({
        title: "File sent",
        description: `${file.name} sent successfully`,
      });
      setFiles((prevFiles) => prevFiles.filter((f) => f !== file));
    } catch (error) {
      console.error("Error sending file:", error);
      toast({
        title: "Failed to send file",
        description: `Failed to send ${file.name}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!webrtc) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      const message = "Are you sure you want to leave? This will cancel any ongoing file transfers.";
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [webrtc]);

  return (
    <div className="space-y-4">
      <DragDropArea 
        isDragging={isDragging}
        onDragIn={onDragIn}
        onDragOut={onDragOut}
        onDrag={onDrag}
        onDrop={onDrop}
        onFileSelect={onFileSelect}
      />
      {files.length > 0 && (
        <FileList
          files={files}
          onRemove={handleRemoveFile}
        />
      )}
    </div>
  );
};
