import { useState, useEffect } from "react";

interface TweetData {
  url: string;
  text: string;
  created_at: string;
  created_timestamp: number;
  author: {
    name: string;
    screen_name: string;
    avatar_url: string;
    avatar_color: string;
    banner_url: string;
  };
  replies: number;
  retweets: number;
  likes: number;
  views: number;
  color: string;
  twitter_card: string;
  lang: string;
  source: string;
  replying_to: string | null;
  replying_to_status: string | null;
  media?: {
    videos?: Array<{
      url: string;
      thumbnail_url: string;
      width: number;
      height: number;
      duration: number;
      format: string;
      type: string;
    }>;
    photos?: Array<{
      type: string;
      url: string;
      width: number;
      height: number;
    }>;
  };
}

interface TweetEmbedProps {
  tweetId: string;
  className?: string;
}

export default function TweetEmbed({
  tweetId,
  className = "",
}: TweetEmbedProps) {
  const [tweetData, setTweetData] = useState<TweetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTweet = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/tweet/${tweetId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch tweet: ${response.status}`);
        }

        const data = await response.json();
        if (data.code !== 200) {
          throw new Error(data.message || "Failed to fetch tweet");
        }

        setTweetData(data.tweet);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tweet");
      } finally {
        setLoading(false);
      }
    };

    fetchTweet();
  }, [tweetId]);

  if (loading) {
    return (
      <div
        className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 ${className}`}
      >
        <div className="animate-pulse">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 ${className}`}
      >
        <p className="text-red-600 dark:text-red-400 text-sm">
          Failed to load tweet: {error}
        </p>
        <a
          href={`https://twitter.com/i/status/${tweetId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm mt-2 inline-block"
        >
          View on Twitter
        </a>
      </div>
    );
  }

  if (!tweetData) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  return (
    <div
      className={`border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md dark:hover:shadow-lg transition-shadow ${className}`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-3">
          <img
            src={tweetData.author.avatar_url}
            alt={tweetData.author.name}
            className="w-10 h-10 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {tweetData.author.name}
              </h3>
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                @{tweetData.author.screen_name}
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {formatDate(tweetData.created_at)}
            </p>
          </div>
        </div>

        {/* Tweet Content */}
        <div className="mb-4">
          <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
            {tweetData.text}
          </p>
        </div>

        {/* Media */}
        {tweetData.media && (
          <div className="mb-4">
            {tweetData.media.photos && (
              <div className="grid grid-cols-1 gap-2">
                {tweetData.media.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo.url}
                    alt={`Tweet media ${index + 1}`}
                    className="rounded-lg max-w-full h-auto"
                  />
                ))}
              </div>
            )}
            {tweetData.media.videos && (
              <div className="space-y-2">
                {tweetData.media.videos.map((video, index) => (
                  <div key={index} className="relative">
                    <video
                      src={video.url}
                      poster={video.thumbnail_url}
                      controls
                      className="rounded-lg max-w-full h-auto"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
          <div className="flex items-center space-x-4">
            <span>{formatNumber(tweetData.replies)} replies</span>
            <span>{formatNumber(tweetData.retweets)} retweets</span>
            <span>{formatNumber(tweetData.likes)} likes</span>
            {tweetData.views && (
              <span>{formatNumber(tweetData.views)} views</span>
            )}
          </div>
          <a
            href={tweetData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            View on Twitter
          </a>
        </div>
      </div>
    </div>
  );
}
