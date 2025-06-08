'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Card, CardBody, CardHeader, Textarea, Spinner, Chip, Divider } from '@heroui/react';
import { ChatMessage, TranscriptItem } from '../../types';

interface TranscriptResponse {
  success: boolean;
  videoId: string;
  url: string;
  language: string;
  transcript: TranscriptItem[];
  transcriptLength: number;
  metadata?: {
    fetchedAt: string;
    duration: number;
    wordCount: number;
    segmentCount: number;
  };
}

interface ChatResponse {
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

export default function Home() {
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [error, setError] = useState('');
  const [transcriptMetadata, setTranscriptMetadata] = useState<any>(null);

  // Extract YouTube video ID from URL
  const extractVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Validate YouTube URL
  const isValidYouTubeUrl = (url: string): boolean => {
    return extractVideoId(url) !== null;
  };

  // Fetch transcript
  const fetchTranscript = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    const extractedVideoId = extractVideoId(url);
    if (!extractedVideoId) {
      setError('Invalid YouTube URL format');
      return;
    }

    setIsLoadingTranscript(true);
    setError('');
    setTranscript([]);
    setMessages([]);
    setSessionId('');

    try {
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          lang: 'en',
          format: 'detailed'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = data.error || 'Failed to fetch transcript';
        
        // Provide specific guidance based on error type
        if (data.code === 'NO_CAPTIONS_AVAILABLE') {
          errorMessage = 'This video does not have captions/subtitles available. Please try a different video that has captions enabled.';
        } else if (data.code === 'VIDEO_NOT_FOUND') {
          errorMessage = 'Video not found. Please check the URL and make sure the video is public.';
        } else if (data.code === 'PRIVATE_VIDEO') {
          errorMessage = 'This video is private or restricted. Please try a public video.';
        }
        
        throw new Error(errorMessage);
      }

      setVideoId(extractedVideoId);
      setTranscript(data.transcript);
      setTranscriptMetadata(data.metadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transcript');
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  // Send chat message
  const sendMessage = async () => {
    if (!currentMessage.trim() || !videoId) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date(),
      videoId,
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoadingChat(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentMessage,
          videoId,
          sessionId: sessionId || undefined,
        }),
      });

      const data: ChatResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get AI response');
      }

      setMessages(prev => [...prev, data.message]);
      if (!sessionId) {
        setSessionId(data.sessionId);
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        timestamp: new Date(),
        videoId,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Download transcript
  const downloadTranscript = (format: 'txt' | 'json' | 'srt') => {
    if (!transcript.length) return;

    let content = '';
    let filename = `transcript_${videoId}.${format}`;
    let mimeType = 'text/plain';

    switch (format) {
      case 'txt':
        content = transcript.map(item => item.text).join(' ');
        break;
      case 'json':
        content = JSON.stringify(transcript, null, 2);
        mimeType = 'application/json';
        break;
      case 'srt':
        content = transcript.map((item, index) => {
          const start = parseFloat(item.start);
          const duration = parseFloat(item.dur);
          const end = start + duration;
          
          const formatTime = (seconds: number) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0').replace('.', ',')}`;
          };

          return `${index + 1}\n${formatTime(start)} --> ${formatTime(end)}\n${item.text}\n`;
        }).join('\n');
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format timestamp for display
  const formatTimestamp = (start: string) => {
    const seconds = parseFloat(start);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
            Chat with YouTube
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Extract transcripts and chat with AI about any YouTube video
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            <p className="mb-2">Try these examples (videos with captions):</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button 
                onClick={() => setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Rick Astley - Never Gonna Give You Up
              </button>
              <span>•</span>
              <button 
                onClick={() => setUrl('https://www.youtube.com/watch?v=9bZkp7q19f0')}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                PSY - Gangnam Style
              </button>
              <span>•</span>
              <button 
                onClick={() => setUrl('https://www.youtube.com/watch?v=kJQP7kiw5Fk')}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Luis Fonsi - Despacito
              </button>
            </div>
          </div>
        </div>

        {/* URL Input Section */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-xl font-semibold">Enter YouTube URL</h2>
          </CardHeader>
          <CardBody>
            <div className="flex gap-2">
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
                isInvalid={!!error && !isLoadingTranscript}
                errorMessage={error}
              />
              <Button
                color="primary"
                onClick={fetchTranscript}
                isLoading={isLoadingTranscript}
                isDisabled={!url.trim() || !isValidYouTubeUrl(url)}
              >
                {isLoadingTranscript ? 'Fetching...' : 'Get Transcript'}
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Main Content Grid */}
        {transcript.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transcript Section */}
            <Card className="h-fit">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Transcript</h2>
                  {transcriptMetadata && (
                    <div className="flex gap-2 mt-2">
                      <Chip size="sm" variant="flat">
                        {transcriptMetadata.segmentCount} segments
                      </Chip>
                      <Chip size="sm" variant="flat">
                        {transcriptMetadata.wordCount} words
                      </Chip>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="flat" onClick={() => downloadTranscript('txt')}>
                    TXT
                  </Button>
                  <Button size="sm" variant="flat" onClick={() => downloadTranscript('srt')}>
                    SRT
                  </Button>
                  <Button size="sm" variant="flat" onClick={() => downloadTranscript('json')}>
                    JSON
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {transcript.map((item, index) => (
                    <div key={index} className="flex gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-mono min-w-[50px]">
                        {formatTimestamp(item.start)}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Chat Section */}
            <Card className="h-fit">
              <CardHeader>
                <h2 className="text-xl font-semibold">Chat with AI</h2>
              </CardHeader>
              <CardBody>
                {/* Messages */}
                <div className="max-h-80 overflow-y-auto mb-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      Start a conversation about this video!
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  {isLoadingChat && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                        <Spinner size="sm" />
                      </div>
                    </div>
                  )}
                </div>

                <Divider className="mb-4" />

                {/* Message Input */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Ask about the video content..."
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    className="flex-1"
                    minRows={1}
                    maxRows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button
                    color="primary"
                    onClick={sendMessage}
                    isLoading={isLoadingChat}
                    isDisabled={!currentMessage.trim() || isLoadingChat}
                  >
                    Send
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Video Embed (if transcript is loaded) */}
        {videoId && (
          <Card className="mt-6">
            <CardHeader>
              <h2 className="text-xl font-semibold">Video</h2>
            </CardHeader>
            <CardBody>
              <div className="aspect-video">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="rounded-lg"
                ></iframe>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
} 