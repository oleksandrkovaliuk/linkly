import * as React from "react";

function emojiToDataUrl(emoji: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "52px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, canvas.width / 2, canvas.height / 2 + 2);

  return canvas.toDataURL("image/png");
}

export function useVaultFavicon(emoji?: string | null) {
  React.useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!icon) return;

    const previousHref = icon.href;
    const resolvedEmoji = emoji?.trim();
    if (resolvedEmoji) {
      const dataUrl = emojiToDataUrl(resolvedEmoji);
      if (dataUrl) {
        icon.href = dataUrl;
      }
    }

    return () => {
      icon.href = previousHref;
    };
  }, [emoji]);
}
