import readingTime from "reading-time";

export interface ReadingStats {
  readingTimeMinutes: number;
  wordCount: number;
  readingTimeText: string;
}

export const calculateReadingStats = (content: string): ReadingStats => {
  const stats = readingTime(content);
  return {
    readingTimeMinutes: Math.max(1, Math.ceil(stats.minutes)),
    wordCount: stats.words,
    readingTimeText: stats.text,
  };
};
