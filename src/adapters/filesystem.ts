import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { StorageAdapter, AffiliateLink, LinksmithConfig } from '../types.js';

interface FileSystemConfig {
  path: string;
}

export class FileSystemAdapter implements StorageAdapter {
  name = 'filesystem';
  private config: FileSystemConfig;

  constructor(config: FileSystemConfig) {
    this.config = config;
  }

  async getLinks(): Promise<AffiliateLink[]> {
    if (!existsSync(this.config.path)) {
      return [];
    }

    const content = readFileSync(this.config.path, 'utf-8');
    return JSON.parse(content);
  }

  async upsertLinks(links: AffiliateLink[]): Promise<void> {
    const existing = await this.getLinks();
    const existingMap = new Map(existing.map(l => [l.slug, l]));

    // Merge new links with existing
    for (const link of links) {
      existingMap.set(link.slug, link);
    }

    const merged = Array.from(existingMap.values());
    writeFileSync(this.config.path, JSON.stringify(merged, null, 2), 'utf-8');
  }

  async getLinkBySlug(slug: string): Promise<AffiliateLink | null> {
    const links = await this.getLinks();
    return links.find(l => l.slug === slug) || null;
  }
}

export function createFileSystemAdapter(config: LinksmithConfig): FileSystemAdapter | null {
  const storageConfig = config.storage;

  if (!storageConfig || storageConfig.adapter !== 'json' || !storageConfig.json) {
    return null;
  }

  return new FileSystemAdapter(storageConfig.json);
}
