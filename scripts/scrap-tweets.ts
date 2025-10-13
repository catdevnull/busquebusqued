const username = process.argv[2];
let maxId: BigInt | undefined = process.argv[3]
  ? BigInt(process.argv[3])
  : undefined;
if (!username) {
  console.error("Username is required");
  process.exit(1);
}

const stderr = Bun.stderr;

let scrapedCount = 0;
let attempts = 0;

while (true) {
  const query = `from:${username}${maxId ? ` max_id:${maxId.toString()}` : ""}`;
  stderr.write(`fetching ${query}\n`);
  const results = await search(query);
  for (const tweet of results.tweets) {
    console.log(JSON.stringify(tweet));
    scrapedCount++;
  }
  const lastTweet = results.tweets[results.tweets.length - 1];
  stderr.write(`max_id: ${lastTweet?.id_str} (${scrapedCount} tweets)\n`);
  if (lastTweet?.id_str) {
    maxId = BigInt(lastTweet.id_str) - BigInt(1);
    attempts = 0;
  } else {
    attempts++;
    if (attempts > 4) {
      break;
    }
  }
}

async function search(query: string): Promise<SocialApiResponseSuccess> {
  const response = await fetch(
    `https://api.socialapi.me/twitter/search?query=${encodeURIComponent(
      query
    )}&type=Latest`,
    {
      headers: {
        Authorization: `Bearer ${process.env.SOCIALAPI_API_KEY}`,
        Accept: "application/json",
      },
    }
  );
  const data = (await response.json()) as SocialApiResponse;
  if ("status" in data || !response.ok) {
    throw new Error(
      `Status ${response.status}: ${
        "message" in data ? data.message : JSON.stringify(data)
      }`
    );
  }
  return data;
}

type SocialApiResponseError = { status: "error"; message: string };
type SocialApiResponseSuccess = { next_cursor: string; tweets: Tweet[] };
type SocialApiResponse = SocialApiResponseError | SocialApiResponseSuccess;

type Tweet = {
  id_str: string;
  text: string | null;
  full_text: string;
  tweet_created_at: string;
  user: {
    id_str: string;
    name: string;
    screen_name: string;
  };
};
