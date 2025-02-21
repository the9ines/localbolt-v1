
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

interface FileInputButtonProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FileInputButton = ({ onFileSelect }: FileInputButtonProps) => {
  return (
    <div className="flex gap-2">
      <Button
        onClick={() => document.getElementById('file-input')?.click()}
        variant="outline"
        className="flex-1"
      >
        <FolderOpen className="w-4 h-4 mr-2" />
        Browse Files
      </Button>
      <input
        type="file"
        id="file-input"
        multiple
        className="hidden"
        onChange={onFileSelect}
      />
    </div>
  );
};
