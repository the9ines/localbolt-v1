
import { Button } from "@/components/ui/button";
import { File, X } from "lucide-react";

interface FileListProps {
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export const FileList = ({ files, onRemove, disabled }: FileListProps) => {
  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-4 bg-dark-accent rounded-lg"
          tabIndex={0}
          role="listitem"
        >
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <File className="w-6 h-6 shrink-0 text-white/50" />
            <span className="text-base truncate pr-2">{file.name}</span>
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              className="text-white/50 hover:text-neon shrink-0 min-h-[48px] min-w-[48px]"
              tabIndex={0}
              aria-label="Remove file"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};
