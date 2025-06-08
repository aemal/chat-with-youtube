import { getSubtitles } from 'youtube-captions-scraper';

// Supported languages for YouTube captions
export const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'da': 'Danish',
  'no': 'Norwegian',
  'fi': 'Finnish',
  'pl': 'Polish',
  'tr': 'Turkish'
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Response format options
export enum ResponseFormat {
  DETAILED = 'detailed',
  SIMPLE = 'simple',
  TEXT_ONLY = 'text_only',
  SRT = 'srt',
  VTT = 'vtt',
  SEGMENTS = 'segments'
}

export interface FormattedTranscriptItem {
  start: number;
  end: number;
  duration: number;
  text: string;
  startTime?: string;
  endTime?: string;
}

// Custom error types for better error handling
export class YouTubeTranscriptError extends Error {
  constructor(
    message: string,
    public code: string,
    public videoId?: string,
    public language?: string
  ) {
    super(message);
    this.name = 'YouTubeTranscriptError';
  }
}

export enum TranscriptErrorCode {
  INVALID_URL = 'INVALID_URL',
  VIDEO_NOT_FOUND = 'VIDEO_NOT_FOUND',
  NO_CAPTIONS_AVAILABLE = 'NO_CAPTIONS_AVAILABLE',
  LANGUAGE_NOT_AVAILABLE = 'LANGUAGE_NOT_AVAILABLE',
  PRIVATE_VIDEO = 'PRIVATE_VIDEO',
  REGION_BLOCKED = 'REGION_BLOCKED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Extract YouTube video ID from various YouTube URL formats
 * @param url - YouTube URL
 * @returns Video ID or null if invalid
 */
export function extractVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

/**
 * Convert seconds to HH:MM:SS.mmm format
 * @param seconds - Time in seconds
 * @returns Formatted time string
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}

/**
 * Format raw transcript data into structured format
 * @param rawTranscript - Raw transcript from youtube-captions-scraper
 * @returns Formatted transcript items
 */
export function formatTranscriptData(rawTranscript: any[]): FormattedTranscriptItem[] {
  return rawTranscript.map((item, index) => {
    const start = parseFloat(item.start);
    const duration = parseFloat(item.dur);
    const end = start + duration;
    
    return {
      start,
      end,
      duration,
      text: item.text.replace(/\n/g, ' ').trim(),
      startTime: formatTime(start),
      endTime: formatTime(end)
    };
  });
}

/**
 * Format transcript for different output formats
 * @param transcript - Formatted transcript data
 * @param format - Desired output format
 * @returns Formatted output
 */
export function formatTranscriptOutput(transcript: FormattedTranscriptItem[], format: ResponseFormat): any {
  switch (format) {
    case ResponseFormat.TEXT_ONLY:
      return transcript.map(item => item.text).join(' ');
    
    case ResponseFormat.SIMPLE:
      return transcript.map(item => ({
        text: item.text,
        start: item.start,
        duration: item.duration
      }));
    
    case ResponseFormat.SRT:
      return transcript.map((item, index) => {
        return `${index + 1}\n${item.startTime?.replace('.', ',')} --> ${item.endTime?.replace('.', ',')}\n${item.text}\n`;
      }).join('\n');
    
    case ResponseFormat.VTT:
      const vttHeader = 'WEBVTT\n\n';
      const vttContent = transcript.map(item => {
        return `${item.startTime} --> ${item.endTime}\n${item.text}\n`;
      }).join('\n');
      return vttHeader + vttContent;
    
    case ResponseFormat.SEGMENTS:
      return transcript.map((item, index) => ({
        id: index + 1,
        start: item.start,
        end: item.end,
        duration: item.duration,
        text: item.text,
        wordCount: item.text.split(' ').length
      }));
    
    case ResponseFormat.DETAILED:
    default:
      return transcript;
  }
}

/**
 * Parse error message to determine specific error type
 * @param error - Error object or message
 * @param videoId - Video ID for context
 * @param language - Language for context
 * @returns Structured error information
 */
function parseTranscriptError(error: any, videoId: string, language: string): YouTubeTranscriptError {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('video unavailable') || lowerMessage.includes('video not found')) {
    return new YouTubeTranscriptError(
      `Video ${videoId} is not available or does not exist`,
      TranscriptErrorCode.VIDEO_NOT_FOUND,
      videoId,
      language
    );
  }

  if (lowerMessage.includes('no captions') || lowerMessage.includes('no subtitles')) {
    return new YouTubeTranscriptError(
      `No captions available for video ${videoId}`,
      TranscriptErrorCode.NO_CAPTIONS_AVAILABLE,
      videoId,
      language
    );
  }

  if (lowerMessage.includes('language not available') || lowerMessage.includes('lang')) {
    return new YouTubeTranscriptError(
      `Language '${language}' not available for video ${videoId}`,
      TranscriptErrorCode.LANGUAGE_NOT_AVAILABLE,
      videoId,
      language
    );
  }

  if (lowerMessage.includes('private') || lowerMessage.includes('restricted')) {
    return new YouTubeTranscriptError(
      `Video ${videoId} is private or restricted`,
      TranscriptErrorCode.PRIVATE_VIDEO,
      videoId,
      language
    );
  }

  if (lowerMessage.includes('blocked') || lowerMessage.includes('region')) {
    return new YouTubeTranscriptError(
      `Video ${videoId} is blocked in your region`,
      TranscriptErrorCode.REGION_BLOCKED,
      videoId,
      language
    );
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('timeout') || lowerMessage.includes('fetch')) {
    return new YouTubeTranscriptError(
      `Network error while fetching transcript for video ${videoId}`,
      TranscriptErrorCode.NETWORK_ERROR,
      videoId,
      language
    );
  }

  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
    return new YouTubeTranscriptError(
      `Rate limited while fetching transcript for video ${videoId}`,
      TranscriptErrorCode.RATE_LIMITED,
      videoId,
      language
    );
  }

  return new YouTubeTranscriptError(
    `Failed to fetch transcript for video ${videoId} in language ${language}: ${errorMessage}`,
    TranscriptErrorCode.UNKNOWN_ERROR,
    videoId,
    language
  );
}

/**
 * Fetch transcript/captions for a YouTube video
 * @param videoId - YouTube video ID
 * @param lang - Language code (default: 'en')
 * @returns Promise with transcript data
 */
export async function fetchTranscript(videoId: string, lang: string = 'en') {
  try {
    const captions = await getSubtitles({
      videoID: videoId,
      lang: lang
    });
    
    if (!captions || captions.length === 0) {
      throw new YouTubeTranscriptError(
        `No captions found for video ${videoId} in language ${lang}`,
        TranscriptErrorCode.NO_CAPTIONS_AVAILABLE,
        videoId,
        lang
      );
    }
    
    return captions;
  } catch (error) {
    if (error instanceof YouTubeTranscriptError) {
      throw error;
    }
    throw parseTranscriptError(error, videoId, lang);
  }
}

/**
 * Fetch transcript with fallback languages
 * @param videoId - YouTube video ID
 * @param preferredLang - Preferred language code
 * @param fallbackLangs - Array of fallback language codes
 * @returns Promise with transcript data and actual language used
 */
export async function fetchTranscriptWithFallback(
  videoId: string, 
  preferredLang: string = 'en',
  fallbackLangs: string[] = ['en', 'es', 'fr', 'de']
) {
  const langsToTry = [preferredLang, ...fallbackLangs.filter(lang => lang !== preferredLang)];
  const errors: YouTubeTranscriptError[] = [];
  
  for (const lang of langsToTry) {
    try {
      const transcript = await fetchTranscript(videoId, lang);
      return {
        transcript,
        language: lang,
        languageName: SUPPORTED_LANGUAGES[lang as SupportedLanguage] || lang,
        attemptedLanguages: langsToTry.slice(0, langsToTry.indexOf(lang) + 1)
      };
    } catch (error) {
      if (error instanceof YouTubeTranscriptError) {
        errors.push(error);
        
        // If it's a video-level error (not language-specific), don't try other languages
        if ([
          TranscriptErrorCode.VIDEO_NOT_FOUND,
          TranscriptErrorCode.PRIVATE_VIDEO,
          TranscriptErrorCode.REGION_BLOCKED,
          TranscriptErrorCode.NO_CAPTIONS_AVAILABLE
        ].includes(error.code as TranscriptErrorCode)) {
          throw error;
        }
      }
      console.log(`Failed to fetch transcript in ${lang}, trying next language...`);
      continue;
    }
  }
  
  // If we get here, all languages failed
  const lastError = errors[errors.length - 1];
  throw new YouTubeTranscriptError(
    `No transcript available for video ${videoId} in any of the attempted languages: ${langsToTry.join(', ')}`,
    TranscriptErrorCode.LANGUAGE_NOT_AVAILABLE,
    videoId,
    preferredLang
  );
}

/**
 * Validate if a string is a valid YouTube URL
 * @param url - URL to validate
 * @returns boolean indicating if URL is valid
 */
export function isValidYouTubeUrl(url: string): boolean {
  const videoId = extractVideoId(url);
  return videoId !== null && videoId.length === 11;
}

/**
 * Check if a language code is supported
 * @param lang - Language code to check
 * @returns boolean indicating if language is supported
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return lang in SUPPORTED_LANGUAGES;
}

/**
 * Get list of all supported languages
 * @returns Array of language objects with code and name
 */
export function getSupportedLanguages() {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    code,
    name
  }));
}

/**
 * Get list of available response formats
 * @returns Array of format objects with code and description
 */
export function getAvailableFormats() {
  return [
    { code: ResponseFormat.DETAILED, description: 'Detailed format with timestamps and metadata' },
    { code: ResponseFormat.SIMPLE, description: 'Simple format with basic text and timing' },
    { code: ResponseFormat.TEXT_ONLY, description: 'Plain text only, no timing information' },
    { code: ResponseFormat.SRT, description: 'SubRip subtitle format (.srt)' },
    { code: ResponseFormat.VTT, description: 'WebVTT subtitle format (.vtt)' },
    { code: ResponseFormat.SEGMENTS, description: 'Segmented format with additional metadata' }
  ];
} 