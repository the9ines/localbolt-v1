
import { ProtocolMetadata } from './ProtocolVersion';

export enum MessageType {
  HELLO = "hello",
  OFFER = "offer",
  ANSWER = "answer",
  ICE_CANDIDATE = "ice-candidate",
  CONNECTION_REQUEST = "connection-request",
  CONNECTION_RESPONSE = "connection-response",
  ERROR = "error",
}

export interface BaseMessage {
  type: MessageType;
  peerId: string;
  timestamp: number;
  protocol: ProtocolMetadata;
}

export interface HelloMessage extends BaseMessage {
  type: MessageType.HELLO;
}

export interface ConnectionRequestMessage extends BaseMessage {
  type: MessageType.CONNECTION_REQUEST;
  preferredTransport: string[];
}

export interface ConnectionResponseMessage extends BaseMessage {
  type: MessageType.CONNECTION_RESPONSE;
  selectedTransport: string;
  status: "accepted" | "rejected";
  reason?: string;
}

export interface WebRTCMessage extends BaseMessage {
  type: MessageType.OFFER | MessageType.ANSWER | MessageType.ICE_CANDIDATE;
  payload: any;
}

export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  code: string;
  message: string;
  details?: any;
}

export type ConnectionMessage = 
  | HelloMessage 
  | ConnectionRequestMessage 
  | ConnectionResponseMessage 
  | WebRTCMessage 
  | ErrorMessage;
