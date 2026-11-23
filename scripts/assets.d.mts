export interface GeneratedManifest {
  themes: Record<string, { background: string; backgroundWide?: string; preview: string }>;
  cardBacks: Record<string, string>;
  cardFaces: Record<string, Record<string, string>>;
}
export const SIZES: {
  background: { width: number; height: number };
  backgroundWide: { width: number; height: number };
  preview: number;
  card: { width: number; height: number };
};
export function buildAssets(opts?: {
  artDir?: string;
  publicDir?: string;
  manifestPath?: string;
  iconSource?: string;
  log?: (msg: string) => void;
}): Promise<{ manifest: GeneratedManifest; warnings: string[] }>;
