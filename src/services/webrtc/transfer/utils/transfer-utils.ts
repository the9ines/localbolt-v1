
import type { TransferProgress } from '../../types/transfer';

export const createTransferProgress = (
  filename: string,
  currentChunk: number = 0,
  totalChunks: number = 0,
  loaded: number = 0,
  total: number = 0,
  status: TransferProgress['status'] = 'transferring'
): TransferProgress => ({
  filename,
  currentChunk,
  totalChunks,
  loaded,
  total,
  status
});

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const calculateProgress = (loaded: number, total: number): number => {
  return Math.round((loaded / total) * 100) || 0;
};
