import OpenAI from 'openai';

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable. Please add it to your .env.local file.');
}

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// OpenAI configuration constants
export const OPENAI_CONFIG = {
  DEFAULT_MODEL: 'gpt-4o-mini',
  MAX_TOKENS: 4000,
  TEMPERATURE: 0.7,
  SYSTEM_PROMPT: `You are an AI assistant that helps users understand and discuss YouTube videos based on their transcripts. 

Your capabilities:
- Answer questions about the video content
- Summarize key points from the transcript
- Explain complex topics mentioned in the video
- Provide timestamps for specific topics when possible
- Help users find relevant information within the video

Guidelines:
- Base your responses strictly on the provided transcript
- If information isn't in the transcript, clearly state that
- Provide specific quotes when relevant
- Be helpful, accurate, and conversational
- If asked about timestamps, reference the transcript timing when available`,
} as const;

// Custom error types for OpenAI operations
export class OpenAIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export enum OpenAIErrorCode {
  API_KEY_INVALID = 'API_KEY_INVALID',
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  CONTENT_FILTERED = 'CONTENT_FILTERED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Parse OpenAI API errors into structured format
 * @param error - Error from OpenAI API
 * @returns Structured OpenAI error
 */
export function parseOpenAIError(error: any): OpenAIError {
  const errorMessage = error?.message || error?.toString() || 'Unknown OpenAI error';
  const statusCode = error?.status || error?.statusCode;

  if (statusCode === 401 || errorMessage.includes('invalid api key')) {
    return new OpenAIError(
      'Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.',
      OpenAIErrorCode.API_KEY_INVALID,
      401
    );
  }

  if (statusCode === 429 || errorMessage.includes('rate limit')) {
    return new OpenAIError(
      'OpenAI API rate limit exceeded. Please try again later.',
      OpenAIErrorCode.RATE_LIMITED,
      429
    );
  }

  if (statusCode === 402 || errorMessage.includes('quota') || errorMessage.includes('billing')) {
    return new OpenAIError(
      'OpenAI API quota exceeded. Please check your billing settings.',
      OpenAIErrorCode.QUOTA_EXCEEDED,
      402
    );
  }

  if (statusCode === 404 || errorMessage.includes('model not found')) {
    return new OpenAIError(
      'OpenAI model not found. Please check the model name.',
      OpenAIErrorCode.MODEL_NOT_FOUND,
      404
    );
  }

  if (errorMessage.includes('content filter') || errorMessage.includes('safety')) {
    return new OpenAIError(
      'Content was filtered by OpenAI safety systems.',
      OpenAIErrorCode.CONTENT_FILTERED,
      400
    );
  }

  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return new OpenAIError(
      'Network error while communicating with OpenAI API.',
      OpenAIErrorCode.NETWORK_ERROR,
      503
    );
  }

  return new OpenAIError(
    `OpenAI API error: ${errorMessage}`,
    OpenAIErrorCode.UNKNOWN_ERROR,
    statusCode || 500
  );
}

/**
 * Test OpenAI API connection
 * @returns Promise<boolean> indicating if connection is successful
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_CONFIG.DEFAULT_MODEL,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
    });
    
    return response.choices.length > 0;
  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    return false;
  }
}

/**
 * Get available OpenAI models
 * @returns Promise with list of available models
 */
export async function getAvailableModels() {
  try {
    const models = await openai.models.list();
    return models.data
      .filter(model => model.id.includes('gpt'))
      .map(model => ({
        id: model.id,
        created: model.created,
        ownedBy: model.owned_by
      }))
      .sort((a, b) => b.created - a.created);
  } catch (error) {
    throw parseOpenAIError(error);
  }
} 