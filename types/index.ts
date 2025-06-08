export interface Transcript {
  text: string;
  start: number;
  duration: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  videoId?: string;
  videoTitle?: string;
}

// YouTube transcript API types
export interface TranscriptItem {
  start: string;
  dur: string;
  text: string;
}

export interface TranscriptResponse {
  success: boolean;
  videoId: string;
  url: string;
  language: string;
  transcript: TranscriptItem[];
  transcriptLength: number;
}

export interface TranscriptError {
  error: string;
}

// OpenAI Chat Types
export interface ChatSession {
  id: string;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  transcript: TranscriptItem[];
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  message: string;
  videoId: string;
  sessionId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  message: ChatMessage;
  sessionId: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  error?: string;
}

export interface OpenAIModel {
  id: string;
  created: number;
  ownedBy: string;
}

export interface ChatContext {
  transcript: TranscriptItem[];
  videoTitle: string;
  videoUrl: string;
  previousMessages: ChatMessage[];
} 