export default async function handler(req, res) {
  // Allow CORS from same origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  // Only allow Google News RSS feeds for security
  if (!url.startsWith("https://news.google.com/rss/")) {
    return res.status(403).json({ error: "Only Google News RSS feeds are allowed" });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; UAENewsApp/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Feed returned ${response.status}` });
    }

    const xml = await response.text();
    
    // Parse XML to JSON server-side
    const items = parseRssXml(xml);
    
    return res.status(200).json({
      status: "ok",
      items,
      fetched: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Feed fetch error:", error.message);
    return res.status(500).json({ error: "Failed to fetch feed", message: error.message });
  }
}

function parseRssXml(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const get = (tag) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
    };

    const title = get("title");
    const link = get("link") || itemXml.match(/<link[^>]*\/>/)?.[0]?.match(/href="([^"]*)"/)?.[1] || "";
    const pubDate = get("pubDate");
    const description = get("description");
    const source = get("source");

    // Extract image from description
    const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/);
    const image = imgMatch ? imgMatch[1] : "";

    if (title) {
      items.push({
        title: title.replace(/<[^>]*>/g, ""),
        link: link.replace(/<[^>]*>/g, "").trim(),
        pubDate,
        description: description.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim().slice(0, 300),
        source: source.replace(/<[^>]*>/g, ""),
        image,
      });
    }
  }

  return items;
}
