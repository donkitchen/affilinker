export interface ExtractedLink {
  url: string;
  text: string;
  file: string;
  line: number;
  column: number;
  isAffiliate: boolean;
  network?: string;
  originalUrl?: string;
}

export interface AffiliateLink {
  slug: string;
  name: string;
  url: string;
  is_affiliate: boolean;
  network?: string;
  created_at?: string;
}

export interface ScanResult {
  files: number;
  links: ExtractedLink[];
  affiliateLinks: ExtractedLink[];
  externalLinks: ExtractedLink[];
}

export interface ConversionResult {
  original: string;
  converted: string;
  network: string;
  tag?: string;
}

export interface TransformResult {
  file: string;
  originalContent: string;
  transformedContent: string;
  linksTransformed: number;
  changes: Array<{
    original: string;
    slug: string;
    trackingUrl: string;
  }>;
}

export interface NetworkPlugin {
  name: string;
  detect(url: string): boolean;
  convert(url: string, options: NetworkOptions): string;
  extractProductId(url: string): string | null;
  generateSlug(url: string, linkText: string): string;
}

export interface NetworkOptions {
  tag?: string;
  cleanParams?: boolean;
}

export interface StorageAdapter {
  name: string;
  getLinks(): Promise<AffiliateLink[]>;
  upsertLinks(links: AffiliateLink[]): Promise<void>;
  getLinkBySlug(slug: string): Promise<AffiliateLink | null>;
}

export interface LinksmithConfig {
  content: {
    include: string[];
    exclude: string[];
  };
  siteUrl: string;
  tracking: {
    baseUrl: string;
    slugStrategy: 'auto' | 'manual';
  };
  networks: {
    amazon?: {
      enabled: boolean;
      tag: string;
      cleanParams?: boolean;
    };
  };
  storage?: {
    adapter: 'supabase' | 'json';
    supabase?: {
      url: string;
      serviceKey: string;
      table: string;
    };
    json?: {
      path: string;
    };
  };
}

export interface ReportOptions {
  format: 'json' | 'csv' | 'sql' | 'markdown';
  output?: string;
  tableName?: string;
}
