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
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
    },
    []
  );

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

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file !== fileToRemove));
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
      <DragDropArea onDrop={onDrop} />
      {files.length > 0 && (
        <FileList
          files={files}
          onSendFile={handleSendFile}
          onRemoveFile={handleRemoveFile}
        />
      )}
    </div>
  );
};
