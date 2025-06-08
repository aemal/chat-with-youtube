declare module 'youtube-captions-scraper' {
  export interface SubtitleOptions {
    videoID: string;
    lang?: string;
  }

  export interface SubtitleItem {
    start: string;
    dur: string;
    text: string;
  }

  export function getSubtitles(options: SubtitleOptions): Promise<SubtitleItem[]>;
} 