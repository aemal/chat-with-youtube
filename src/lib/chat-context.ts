import { ChatMessage, ChatSession, TranscriptItem, ChatContext } from '../../types';
import { OPENAI_CONFIG } from './openai';

/**
 * Maximum number of messages to keep in context to avoid token limits
 */
const MAX_CONTEXT_MESSAGES = 20;

/**
 * Maximum number of characters for transcript context
 */
const MAX_TRANSCRIPT_CHARS = 50000;

/**
 * Create a formatted context string from transcript
 * @param transcript - Array of transcript items
 * @returns Formatted transcript string with timestamps
 */
export function formatTranscriptContext(transcript: TranscriptItem[]): string {
  let formattedTranscript = transcript
    .map(item => {
      const startTime = parseFloat(item.start);
      const minutes = Math.floor(startTime / 60);
      const seconds = Math.floor(startTime % 60);
      const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      return `[${timestamp}] ${item.text}`;
    })
    .join('\n');

  // Truncate if too long to avoid token limits
  if (formattedTranscript.length > MAX_TRANSCRIPT_CHARS) {
    const truncatePoint = MAX_TRANSCRIPT_CHARS - 100;
    formattedTranscript = formattedTranscript.substring(0, truncatePoint) + 
      '\n\n[... transcript truncated for length ...]';
  }

  return formattedTranscript;
}

/**
 * Build conversation context for OpenAI API
 * @param session - Chat session data
 * @param includeSystemPrompt - Whether to include system prompt
 * @returns Array of messages for OpenAI API
 */
export function buildConversationContext(
  session: ChatSession, 
  includeSystemPrompt: boolean = true
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // Add system prompt with video context
  if (includeSystemPrompt) {
    const transcriptContext = formatTranscriptContext(session.transcript);
    
    const systemContent = `${OPENAI_CONFIG.SYSTEM_PROMPT}

Video Information:
- Title: ${session.videoTitle}
- URL: ${session.videoUrl}
- Video ID: ${session.videoId}
- Total Segments: ${session.transcript.length}

Transcript:
${transcriptContext}`;

    messages.push({
      role: 'system',
      content: systemContent
    });
  }

  // Add recent conversation history (limit to avoid token overflow)
  const recentMessages = session.messages
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

  messages.push(...recentMessages);

  return messages;
}

/**
 * Estimate token count for a message (rough approximation)
 * @param content - Message content
 * @returns Estimated token count
 */
export function estimateTokenCount(content: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(content.length / 4);
}

/**
 * Calculate total estimated tokens for conversation context
 * @param messages - Array of messages
 * @returns Estimated total token count
 */
export function calculateContextTokens(
  messages: Array<{ role: string; content: string }>
): number {
  return messages.reduce((total, msg) => total + estimateTokenCount(msg.content), 0);
}

/**
 * Trim conversation context to fit within token limits
 * @param messages - Array of messages
 * @param maxTokens - Maximum allowed tokens
 * @returns Trimmed messages array
 */
export function trimContextToTokenLimit(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxTokens: number = 12000 // Leave room for response
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  let totalTokens = calculateContextTokens(messages);
  
  if (totalTokens <= maxTokens) {
    return messages;
  }

  // Always keep system message (first message)
  const systemMessage = messages[0];
  const conversationMessages = messages.slice(1);
  
  // Remove oldest conversation messages until we're under the limit
  let trimmedMessages = [...conversationMessages];
  totalTokens = estimateTokenCount(systemMessage.content) + calculateContextTokens(trimmedMessages);
  
  while (totalTokens > maxTokens && trimmedMessages.length > 1) {
    trimmedMessages.shift(); // Remove oldest message
    totalTokens = estimateTokenCount(systemMessage.content) + calculateContextTokens(trimmedMessages);
  }

  return [systemMessage, ...trimmedMessages];
}

/**
 * Find relevant transcript segments based on user query
 * @param query - User's question or message
 * @param transcript - Full transcript
 * @param maxSegments - Maximum number of segments to return
 * @returns Array of relevant transcript segments
 */
export function findRelevantTranscriptSegments(
  query: string,
  transcript: TranscriptItem[],
  maxSegments: number = 10
): TranscriptItem[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
  
  if (queryWords.length === 0) {
    // If no meaningful words, return first few segments
    return transcript.slice(0, maxSegments);
  }

  // Score each segment based on keyword matches
  const scoredSegments = transcript.map((segment, index) => {
    const segmentText = segment.text.toLowerCase();
    let score = 0;
    
    // Count keyword matches
    queryWords.forEach(word => {
      const matches = (segmentText.match(new RegExp(word, 'g')) || []).length;
      score += matches;
    });
    
    // Boost score for exact phrase matches
    if (segmentText.includes(queryLower)) {
      score += 5;
    }
    
    return { segment, score, index };
  });

  // Sort by score and return top segments
  return scoredSegments
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSegments)
    .sort((a, b) => a.index - b.index) // Maintain chronological order
    .map(item => item.segment);
}

/**
 * Create enhanced context with relevant transcript segments
 * @param session - Chat session
 * @param userQuery - Current user query
 * @returns Enhanced chat context
 */
export function createEnhancedContext(
  session: ChatSession,
  userQuery: string
): ChatContext {
  const relevantSegments = findRelevantTranscriptSegments(
    userQuery,
    session.transcript,
    15
  );

  return {
    transcript: relevantSegments.length > 0 ? relevantSegments : session.transcript.slice(0, 20),
    videoTitle: session.videoTitle,
    videoUrl: session.videoUrl,
    previousMessages: session.messages.slice(-10) // Last 10 messages for context
  };
}

/**
 * Validate chat session data
 * @param session - Chat session to validate
 * @returns Validation result with any errors
 */
export function validateChatSession(session: any): { 
  isValid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];

  if (!session) {
    errors.push('Session is null or undefined');
    return { isValid: false, errors };
  }

  if (!session.id || typeof session.id !== 'string') {
    errors.push('Session ID is missing or invalid');
  }

  if (!session.videoId || typeof session.videoId !== 'string') {
    errors.push('Video ID is missing or invalid');
  }

  if (!session.transcript || !Array.isArray(session.transcript)) {
    errors.push('Transcript is missing or not an array');
  }

  if (!session.messages || !Array.isArray(session.messages)) {
    errors.push('Messages array is missing or invalid');
  }

  if (!session.createdAt || !(session.createdAt instanceof Date)) {
    errors.push('Created date is missing or invalid');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Clean up old chat sessions (for memory management)
 * @param sessions - Map of chat sessions
 * @param maxAge - Maximum age in milliseconds (default: 24 hours)
 * @returns Number of sessions cleaned up
 */
export function cleanupOldSessions(
  sessions: Map<string, ChatSession>,
  maxAge: number = 24 * 60 * 60 * 1000 // 24 hours
): number {
  const now = new Date();
  let cleanedCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    const age = now.getTime() - session.updatedAt.getTime();
    if (age > maxAge) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

/**
 * Get session statistics
 * @param session - Chat session
 * @returns Session statistics object
 */
export function getSessionStats(session: ChatSession) {
  const totalMessages = session.messages.length;
  const userMessages = session.messages.filter(m => m.role === 'user').length;
  const assistantMessages = session.messages.filter(m => m.role === 'assistant').length;
  const totalTranscriptLength = session.transcript.reduce((sum, item) => sum + item.text.length, 0);
  const sessionDuration = session.updatedAt.getTime() - session.createdAt.getTime();

  return {
    totalMessages,
    userMessages,
    assistantMessages,
    transcriptSegments: session.transcript.length,
    totalTranscriptLength,
    sessionDurationMs: sessionDuration,
    lastActivity: session.updatedAt
  };
} 