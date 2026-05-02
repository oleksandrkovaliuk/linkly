export async function extractMetadata(url: string) {
  const safeDomain = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();

  try {
    const response = await fetch(url);
    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch =
      html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i) ||
      html.match(
        /<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i
      );
    const imageMatch = html.match(
      /<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i
    );

    return {
      title: titleMatch?.[1]?.trim() || url,
      description: descMatch?.[1]?.trim(),
      favicon: `https://www.google.com/s2/favicons?domain=${safeDomain}&sz=32`,
      image: imageMatch?.[1]?.trim(),
    };
  } catch {
    return {
      title: url,
      favicon: `https://www.google.com/s2/favicons?domain=${safeDomain}&sz=32`,
    };
  }
}
