import type { StorageAdapter, AffiliateLink, LinksmithConfig } from '../types.js';

interface SupabaseConfig {
  url: string;
  serviceKey: string;
  table: string;
}

export class SupabaseAdapter implements StorageAdapter {
  name = 'supabase';
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig) {
    this.config = config;
  }

  async getLinks(): Promise<AffiliateLink[]> {
    const response = await fetch(
      `${this.config.url}/rest/v1/${this.config.table}?select=*`,
      {
        headers: {
          'apikey': this.config.serviceKey,
          'Authorization': `Bearer ${this.config.serviceKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch links: ${response.statusText}`);
    }

    return response.json() as Promise<AffiliateLink[]>;
  }

  async upsertLinks(links: AffiliateLink[]): Promise<void> {
    if (links.length === 0) return;

    const response = await fetch(
      `${this.config.url}/rest/v1/${this.config.table}`,
      {
        method: 'POST',
        headers: {
          'apikey': this.config.serviceKey,
          'Authorization': `Bearer ${this.config.serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(links),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upsert links: ${response.statusText} - ${error}`);
    }
  }

  async getLinkBySlug(slug: string): Promise<AffiliateLink | null> {
    const response = await fetch(
      `${this.config.url}/rest/v1/${this.config.table}?slug=eq.${encodeURIComponent(slug)}&limit=1`,
      {
        headers: {
          'apikey': this.config.serviceKey,
          'Authorization': `Bearer ${this.config.serviceKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch link: ${response.statusText}`);
    }

    const results = await response.json() as AffiliateLink[];
    return results[0] || null;
  }
}

export function createSupabaseAdapter(config: LinksmithConfig): SupabaseAdapter | null {
  const storageConfig = config.storage;

  if (!storageConfig || storageConfig.adapter !== 'supabase' || !storageConfig.supabase) {
    return null;
  }

  return new SupabaseAdapter(storageConfig.supabase);
}
