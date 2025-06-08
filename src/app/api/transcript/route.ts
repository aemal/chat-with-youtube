import { NextResponse } from 'next/server';
import { 
  extractVideoId, 
  fetchTranscriptWithFallback, 
  isValidYouTubeUrl, 
  isSupportedLanguage,
  getSupportedLanguages,
  getAvailableFormats,
  formatTranscriptData,
  formatTranscriptOutput,
  YouTubeTranscriptError,
  TranscriptErrorCode,
  ResponseFormat
} from '@/lib/youtube';

export async function GET() {
  // Return supported languages and formats
  return NextResponse.json({
    supportedLanguages: getSupportedLanguages(),
    availableFormats: getAvailableFormats(),
    defaultLanguage: 'en',
    defaultFormat: ResponseFormat.DETAILED,
    fallbackLanguages: ['en', 'es', 'fr', 'de']
  });
}

export async function POST(request: Request) {
  try {
    const { 
      url, 
      lang = 'en', 
      format = ResponseFormat.DETAILED,
      useFallback = true,
      fallbackLanguages = ['en', 'es', 'fr', 'de']
    } = await request.json();

    // Validate input
    if (!url) {
      return NextResponse.json(
        { 
          error: 'YouTube URL is required',
          code: TranscriptErrorCode.INVALID_URL
        }, 
        { status: 400 }
      );
    }

    // Validate YouTube URL format
    if (!isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { 
          error: 'Invalid YouTube URL format',
          code: TranscriptErrorCode.INVALID_URL,
          supportedFormats: [
            'https://www.youtube.com/watch?v=VIDEO_ID',
            'https://youtu.be/VIDEO_ID',
            'https://www.youtube.com/embed/VIDEO_ID'
          ]
        }, 
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return NextResponse.json(
        { 
          error: 'Could not extract video ID from URL',
          code: TranscriptErrorCode.INVALID_URL
        }, 
        { status: 400 }
      );
    }

    // Validate language if provided
    if (lang && !isSupportedLanguage(lang)) {
      return NextResponse.json(
        {
          error: `Language '${lang}' is not supported`,
          code: TranscriptErrorCode.LANGUAGE_NOT_AVAILABLE,
          supportedLanguages: getSupportedLanguages(),
          suggestedLanguage: 'en'
        },
        { status: 400 }
      );
    }

    // Validate format if provided
    if (format && !Object.values(ResponseFormat).includes(format)) {
      return NextResponse.json(
        {
          error: `Format '${format}' is not supported`,
          availableFormats: getAvailableFormats(),
          suggestedFormat: ResponseFormat.DETAILED
        },
        { status: 400 }
      );
    }

    // Fetch transcript with or without fallback
    let result;
    if (useFallback) {
      result = await fetchTranscriptWithFallback(videoId, lang, fallbackLanguages);
    } else {
      const { fetchTranscript } = await import('@/lib/youtube');
      const transcript = await fetchTranscript(videoId, lang);
      result = {
        transcript,
        language: lang,
        languageName: getSupportedLanguages().find(l => l.code === lang)?.name || lang,
        attemptedLanguages: [lang]
      };
    }

    // Format the transcript data
    const formattedTranscript = formatTranscriptData(result.transcript);
    const outputData = formatTranscriptOutput(formattedTranscript, format);

    // Prepare response based on format
    const baseResponse = {
      success: true,
      videoId,
      url,
      requestedLanguage: lang,
      actualLanguage: result.language,
      languageName: result.languageName,
      format,
      usedFallback: useFallback && result.language !== lang,
      attemptedLanguages: result.attemptedLanguages,
      metadata: {
        fetchedAt: new Date().toISOString(),
        totalSegments: formattedTranscript.length,
        totalDuration: formattedTranscript.length > 0 ? 
          formattedTranscript[formattedTranscript.length - 1].end : 0,
        wordCount: formattedTranscript.reduce((count, item) => 
          count + item.text.split(' ').length, 0)
      }
    };

    // For text-only format, return plain text response
    if (format === ResponseFormat.TEXT_ONLY) {
      return new Response(outputData, {
        headers: {
          'Content-Type': 'text/plain',
          'X-Video-ID': videoId,
          'X-Language': result.language,
          'X-Format': format
        }
      });
    }

    // For SRT format, return with appropriate content type
    if (format === ResponseFormat.SRT) {
      return new Response(outputData, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${videoId}.srt"`,
          'X-Video-ID': videoId,
          'X-Language': result.language,
          'X-Format': format
        }
      });
    }

    // For VTT format, return with appropriate content type
    if (format === ResponseFormat.VTT) {
      return new Response(outputData, {
        headers: {
          'Content-Type': 'text/vtt',
          'Content-Disposition': `attachment; filename="${videoId}.vtt"`,
          'X-Video-ID': videoId,
          'X-Language': result.language,
          'X-Format': format
        }
      });
    }

    // For JSON formats, return structured response
    return NextResponse.json({
      ...baseResponse,
      transcript: outputData
    });

  } catch (error) {
    console.error('Transcript API error:', error);
    
    // Handle custom YouTube transcript errors
    if (error instanceof YouTubeTranscriptError) {
      const statusCode = getStatusCodeForError(error.code);
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          videoId: error.videoId,
          language: error.language,
          suggestions: getSuggestionsForError(error.code)
        }, 
        { status: statusCode }
      );
    }

    // Handle other errors
    return NextResponse.json(
      { 
        error: 'Internal server error while fetching transcript',
        code: TranscriptErrorCode.UNKNOWN_ERROR
      }, 
      { status: 500 }
    );
  }
}

/**
 * Get appropriate HTTP status code for error type
 */
function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case TranscriptErrorCode.INVALID_URL:
      return 400;
    case TranscriptErrorCode.VIDEO_NOT_FOUND:
    case TranscriptErrorCode.NO_CAPTIONS_AVAILABLE:
    case TranscriptErrorCode.LANGUAGE_NOT_AVAILABLE:
      return 404;
    case TranscriptErrorCode.PRIVATE_VIDEO:
    case TranscriptErrorCode.REGION_BLOCKED:
      return 403;
    case TranscriptErrorCode.RATE_LIMITED:
      return 429;
    case TranscriptErrorCode.NETWORK_ERROR:
      return 502;
    default:
      return 500;
  }
}

/**
 * Get helpful suggestions based on error type
 */
function getSuggestionsForError(errorCode: string): string[] {
  switch (errorCode) {
    case TranscriptErrorCode.NO_CAPTIONS_AVAILABLE:
      return [
        'Try a different video that has captions enabled',
        'Check if the video has auto-generated captions',
        'Contact the video creator to add captions'
      ];
    case TranscriptErrorCode.LANGUAGE_NOT_AVAILABLE:
      return [
        'Try using English (en) as it\'s most commonly available',
        'Enable fallback languages in your request',
        'Check available languages for this video'
      ];
    case TranscriptErrorCode.PRIVATE_VIDEO:
      return [
        'Ensure the video is public',
        'Check if you have permission to access this video',
        'Try a different public video'
      ];
    case TranscriptErrorCode.REGION_BLOCKED:
      return [
        'Try accessing from a different region',
        'Use a VPN if appropriate',
        'Try a different video that\'s available in your region'
      ];
    case TranscriptErrorCode.RATE_LIMITED:
      return [
        'Wait a few minutes before trying again',
        'Reduce the frequency of requests',
        'Implement request throttling in your application'
      ];
    default:
      return [
        'Try again in a few moments',
        'Check your internet connection',
        'Verify the YouTube URL is correct'
      ];
  }
} 