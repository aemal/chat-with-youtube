import { NextRequest, NextResponse } from 'next/server';
import { openai, OPENAI_CONFIG, parseOpenAIError } from '@/lib/openai';
import { fetchTranscriptWithFallback } from '@/lib/youtube';
import { ChatRequest, ChatResponse, ChatMessage, TranscriptItem } from '../../../../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  buildConversationContext, 
  trimContextToTokenLimit, 
  validateChatSession,
  cleanupOldSessions,
  getSessionStats
} from '@/lib/chat-context';

// Import the SubtitleItem type from youtube-captions-scraper
interface SubtitleItem {
  start: string;
  dur: string;
  text: string;
}

// In-memory storage for chat sessions (in production, use a database)
const chatSessions = new Map<string, {
  id: string;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  transcript: TranscriptItem[];
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}>();



/**
 * Extract video title from transcript metadata or URL
 */
function extractVideoTitle(videoId: string, videoUrl: string): string {
  // In a real implementation, you might fetch this from YouTube API
  // For now, return a placeholder
  return `YouTube Video ${videoId}`;
}

/**
 * POST /api/chat - Send a message and get AI response
 */
export async function POST(request: NextRequest) {
  try {
    // Periodic cleanup of old sessions (every 10th request)
    if (Math.random() < 0.1) {
      const cleanedCount = cleanupOldSessions(chatSessions);
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} old chat sessions`);
      }
    }

    const body: ChatRequest = await request.json();
    const { message, videoId, sessionId, model, temperature, maxTokens } = body;

    // Comprehensive input validation
    const validationErrors: string[] = [];
    
    if (!message || typeof message !== 'string') {
      validationErrors.push('Message is required and must be a string');
    } else if (message.trim().length === 0) {
      validationErrors.push('Message cannot be empty');
    } else if (message.length > 4000) {
      validationErrors.push('Message is too long (maximum 4000 characters)');
    }
    
    if (!videoId || typeof videoId !== 'string') {
      validationErrors.push('Video ID is required and must be a string');
    } else if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      validationErrors.push('Invalid YouTube video ID format');
    }
    
    if (sessionId && typeof sessionId !== 'string') {
      validationErrors.push('Session ID must be a string if provided');
    }
    
    if (model && typeof model !== 'string') {
      validationErrors.push('Model must be a string if provided');
    }
    
    if (temperature !== undefined) {
      if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
        validationErrors.push('Temperature must be a number between 0 and 2');
      }
    }
    
    if (maxTokens !== undefined) {
      if (typeof maxTokens !== 'number' || maxTokens < 1 || maxTokens > 8000) {
        validationErrors.push('Max tokens must be a number between 1 and 8000');
      }
    }
    
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationErrors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Get or create session
    let session = sessionId ? chatSessions.get(sessionId) : null;
    
    if (!session) {
      // Create new session - fetch transcript
      try {
        const transcriptData = await fetchTranscriptWithFallback(videoId);
        
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const videoTitle = extractVideoTitle(videoId, videoUrl);

        // Convert SubtitleItem[] to TranscriptItem[]
        const transcript: TranscriptItem[] = transcriptData.transcript.map(item => ({
          start: item.start,
          dur: item.dur,
          text: item.text
        }));

        session = {
          id: uuidv4(),
          videoId,
          videoTitle,
          videoUrl,
          transcript,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        chatSessions.set(session.id, session);
      } catch (error) {
        console.error('Error fetching transcript:', error);
        
        // Handle specific YouTube transcript errors
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          
          if (errorMessage.includes('video unavailable') || errorMessage.includes('not found')) {
            return NextResponse.json(
              { 
                error: 'Video not found or unavailable',
                details: 'The YouTube video may be private, deleted, or the ID is incorrect',
                code: 'VIDEO_NOT_FOUND'
              },
              { status: 404 }
            );
          }
          
          if (errorMessage.includes('no captions') || errorMessage.includes('no subtitles')) {
            return NextResponse.json(
              { 
                error: 'No captions available',
                details: 'This video does not have captions or subtitles available',
                code: 'NO_CAPTIONS_AVAILABLE'
              },
              { status: 400 }
            );
          }
          
          if (errorMessage.includes('private') || errorMessage.includes('restricted')) {
            return NextResponse.json(
              { 
                error: 'Video is private or restricted',
                details: 'Cannot access captions for private or restricted videos',
                code: 'PRIVATE_VIDEO'
              },
              { status: 403 }
            );
          }
          
          if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
            return NextResponse.json(
              { 
                error: 'Rate limited',
                details: 'Too many requests. Please try again later',
                code: 'RATE_LIMITED'
              },
              { status: 429 }
            );
          }
        }
        
        return NextResponse.json(
          { 
            error: 'Failed to fetch video transcript',
            details: error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'TRANSCRIPT_FETCH_ERROR'
          },
          { status: 500 }
        );
      }
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date(),
      videoId: session.videoId,
      videoTitle: session.videoTitle
    };

    // Add user message to session
    session.messages.push(userMessage);

    // Validate session before processing
    const validation = validateChatSession(session);
    if (!validation.isValid) {
      console.error('Invalid session:', validation.errors);
      return NextResponse.json(
        { error: 'Invalid session data', details: validation.errors },
        { status: 400 }
      );
    }

    // Build conversation context with proper token management
    const contextMessages = buildConversationContext(session, true);
    const trimmedMessages = trimContextToTokenLimit(contextMessages, 12000);

    // Call OpenAI API
    try {
      const completion = await openai.chat.completions.create({
        model: model || OPENAI_CONFIG.DEFAULT_MODEL,
        messages: trimmedMessages,
        max_tokens: maxTokens || OPENAI_CONFIG.MAX_TOKENS,
        temperature: temperature || OPENAI_CONFIG.TEMPERATURE,
      });

      const assistantContent = completion.choices[0]?.message?.content;
      
      if (!assistantContent) {
        throw new Error('No response from OpenAI');
      }

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        videoId: session.videoId,
        videoTitle: session.videoTitle
      };

      // Add assistant message to session
      session.messages.push(assistantMessage);
      session.updatedAt = new Date();

      // Prepare response
      const response: ChatResponse = {
        message: assistantMessage,
        sessionId: session.id,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0
        },
        model: completion.model
      };

      return NextResponse.json(response);

    } catch (error) {
      console.error('OpenAI API error:', error);
      const openaiError = parseOpenAIError(error);
      
      // Add specific suggestions based on error type
      let suggestions: string[] = [];
      
      switch (openaiError.code) {
        case 'API_KEY_INVALID':
          suggestions = [
            'Verify your OpenAI API key is correct',
            'Check that the API key has the necessary permissions',
            'Ensure the API key is properly set in environment variables'
          ];
          break;
        case 'RATE_LIMITED':
          suggestions = [
            'Wait a few moments before trying again',
            'Consider upgrading your OpenAI plan for higher rate limits',
            'Try using a different model if available'
          ];
          break;
        case 'QUOTA_EXCEEDED':
          suggestions = [
            'Check your OpenAI billing and usage limits',
            'Add payment method or increase spending limits',
            'Monitor your API usage in the OpenAI dashboard'
          ];
          break;
        case 'CONTENT_FILTERED':
          suggestions = [
            'Rephrase your question to avoid potentially sensitive content',
            'Try asking about the video content in a different way',
            'Focus on factual questions about the video transcript'
          ];
          break;
        default:
          suggestions = [
            'Try again in a few moments',
            'Check your internet connection',
            'Contact support if the issue persists'
          ];
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to generate AI response',
          details: openaiError.message,
          code: openaiError.code,
          suggestions,
          timestamp: new Date().toISOString()
        },
        { status: openaiError.statusCode || 500 }
      );
    }

  } catch (error) {
    console.error('Chat API error:', error);
    
    // Categorize and handle different types of errors
    let errorResponse = {
      error: 'Internal server error',
      details: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    };
    
    let statusCode = 500;
    
    if (error instanceof SyntaxError) {
      errorResponse = {
        error: 'Invalid JSON',
        details: 'Request body contains invalid JSON',
        code: 'INVALID_JSON',
        timestamp: new Date().toISOString()
      };
      statusCode = 400;
    } else if (error instanceof TypeError) {
      errorResponse = {
        error: 'Type error',
        details: 'Invalid data type in request',
        code: 'TYPE_ERROR',
        timestamp: new Date().toISOString()
      };
      statusCode = 400;
    } else if (error instanceof Error) {
      errorResponse.details = error.message;
      
      // Check for specific error patterns
      if (error.message.includes('timeout')) {
        errorResponse.error = 'Request timeout';
        errorResponse.code = 'TIMEOUT_ERROR';
        statusCode = 408;
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorResponse.error = 'Network error';
        errorResponse.code = 'NETWORK_ERROR';
        statusCode = 503;
      }
    }
    
    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

/**
 * GET /api/chat?sessionId=xxx - Get chat session details
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { 
          error: 'Missing sessionId parameter',
          details: 'sessionId query parameter is required',
          code: 'MISSING_SESSION_ID'
        },
        { status: 400 }
      );
    }

    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return NextResponse.json(
        { 
          error: 'Invalid sessionId parameter',
          details: 'sessionId must be a non-empty string',
          code: 'INVALID_SESSION_ID'
        },
        { status: 400 }
      );
    }

    const session = chatSessions.get(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { 
          error: 'Session not found',
          details: `No chat session found with ID: ${sessionId}`,
          code: 'SESSION_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const stats = getSessionStats(session);

    return NextResponse.json({
      session: {
        id: session.id,
        videoId: session.videoId,
        videoTitle: session.videoTitle,
        videoUrl: session.videoUrl,
        messages: session.messages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      },
      statistics: stats
    });

  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat?sessionId=xxx - Delete chat session
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { 
          error: 'Missing sessionId parameter',
          details: 'sessionId query parameter is required',
          code: 'MISSING_SESSION_ID'
        },
        { status: 400 }
      );
    }

    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return NextResponse.json(
        { 
          error: 'Invalid sessionId parameter',
          details: 'sessionId must be a non-empty string',
          code: 'INVALID_SESSION_ID'
        },
        { status: 400 }
      );
    }

    const deleted = chatSessions.delete(sessionId);
    
    if (!deleted) {
      return NextResponse.json(
        { 
          error: 'Session not found',
          details: `No chat session found with ID: ${sessionId}`,
          code: 'SESSION_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: `Session ${sessionId} deleted successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 