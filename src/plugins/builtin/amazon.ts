import slugify from 'slugify';
import type { NetworkPlugin, NetworkOptions } from '../../types.js';

const AMAZON_DOMAINS = [
  'amazon.com',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.it',
  'amazon.es',
  'amazon.ca',
  'amazon.com.au',
  'amazon.co.jp',
  'amazon.in',
  'amzn.to',
  'amzn.com',
];

const AMAZON_PATTERNS = [
  // Standard product page: /dp/ASIN or /gp/product/ASIN
  /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i,
  // Short URL redirect
  /amzn\.to\/([A-Za-z0-9]+)/,
  // Old format with ref
  /\/(?:gp\/product|dp)\/([A-Z0-9]{10})\/ref=/i,
];

export class AmazonPlugin implements NetworkPlugin {
  name = 'amazon';

  detect(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase().replace('www.', '');

      // Check if it's an Amazon domain
      const isAmazonDomain = AMAZON_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (!isAmazonDomain) return false;

      // Check if it has an affiliate tag or looks like an affiliate link
      const hasTag = parsed.searchParams.has('tag') ||
                     url.includes('tag=') ||
                     url.includes('linkCode=') ||
                     url.includes('creative=') ||
                     url.includes('camp=');

      // Even without explicit tag, Amazon product links can be affiliate
      const isProductLink = AMAZON_PATTERNS.some(pattern => pattern.test(url));

      return hasTag || isProductLink;
    } catch {
      return false;
    }
  }

  convert(url: string, options: NetworkOptions): string {
    const { tag, cleanParams = true } = options;

    const asin = this.extractProductId(url);
    if (!asin) {
      // If we can't extract ASIN, just add/update the tag
      return this.updateTag(url, tag);
    }

    // Determine the base domain
    const domain = this.extractDomain(url);

    // Build clean URL
    let cleanUrl = `https://www.${domain}/dp/${asin}`;

    if (tag) {
      cleanUrl += `?tag=${tag}`;
    }

    return cleanUrl;
  }

  extractProductId(url: string): string | null {
    for (const pattern of AMAZON_PATTERNS) {
      const match = url.match(pattern);
      if (match && match[1]) {
        // For amzn.to links, we can't extract the ASIN directly
        if (url.includes('amzn.to')) {
          return null;
        }
        return match[1];
      }
    }

    return null;
  }

  generateSlug(url: string, linkText: string): string {
    // Try to create a meaningful slug from the link text
    if (linkText && linkText !== url) {
      const slug = slugify(linkText, {
        lower: true,
        strict: true,
        trim: true,
      });

      // Limit length and clean up
      return slug.slice(0, 50).replace(/-+$/, '');
    }

    // Fallback to ASIN-based slug
    const asin = this.extractProductId(url);
    if (asin) {
      return `amazon-${asin.toLowerCase()}`;
    }

    // Last resort: use domain + random
    return `amazon-product-${Date.now().toString(36)}`;
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase().replace('www.', '');

      // Find matching Amazon domain
      const domain = AMAZON_DOMAINS.find(d =>
        hostname === d || hostname.endsWith('.' + d)
      );

      return domain || 'amazon.com';
    } catch {
      return 'amazon.com';
    }
  }

  private updateTag(url: string, tag?: string): string {
    if (!tag) return url;

    try {
      const parsed = new URL(url);

      // Remove old affiliate params
      parsed.searchParams.delete('tag');
      parsed.searchParams.delete('linkCode');
      parsed.searchParams.delete('creative');
      parsed.searchParams.delete('creativeASIN');
      parsed.searchParams.delete('camp');
      parsed.searchParams.delete('ref');

      // Add new tag
      parsed.searchParams.set('tag', tag);

      return parsed.toString();
    } catch {
      // If URL parsing fails, try simple string replacement
      if (url.includes('tag=')) {
        return url.replace(/tag=[^&]+/, `tag=${tag}`);
      }
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}tag=${tag}`;
    }
  }
}

export function createAmazonPlugin(): AmazonPlugin {
  return new AmazonPlugin();
}
