export function getVaultTintStyle(color?: string | null) {
  const resolved = color?.trim();
  if (!resolved) return undefined;

  return {
    borderColor: `${resolved}40`,
    backgroundColor: `${resolved}14`,
  };
}
