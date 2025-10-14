/**
 * Basic web scraper library for extracting headings from websites
 */

export interface Heading {
  level: number;
  text: string;
}

/**
 * Decode HTML entities to proper characters
 */
function decodeHtmlEntities(text: string): string {
  // Simple HTML entity decoding for common entities
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
  };

  return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
    return entities[entity] || entity;
  });
}

/**
 * Clean heading text by removing HTML tags and normalizing whitespace
 */
function cleanHeadingText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Extract headings from HTML content
 */
export function extractHeadings(html: string): Heading[] {
  const headingPatterns = [
    /<h1[^>]*>(.*?)<\/h1>/gi, // H1 tags
    /<h2[^>]*>(.*?)<\/h2>/gi, // H2 tags
    /<h3[^>]*>(.*?)<\/h3>/gi, // H3 tags
  ];

  const headings: Heading[] = [];

  headingPatterns.forEach((pattern, index) => {
    const matches = html.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        const cleanText = cleanHeadingText(match);
        const decodedText = decodeHtmlEntities(cleanText);

        if (decodedText && decodedText.length > 0) {
          headings.push({
            level: index + 1,
            text: decodedText,
          });
        }
      });
    }
  });

  return headings;
}

/**
 * Scrape headings from a URL
 */
export async function scrapeHeadings(url: string): Promise<Heading[]> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the response as ArrayBuffer first to handle encoding properly
    const arrayBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder("iso-8859-1", { fatal: false });
    const html = decoder.decode(arrayBuffer);

    return extractHeadings(html);
  } catch (error) {
    throw new Error(`Failed to scrape headings from ${url}: ${error}`);
  }
}
