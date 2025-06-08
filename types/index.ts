export interface Transcript {
  text: string;
  start: number;
  duration: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
} 