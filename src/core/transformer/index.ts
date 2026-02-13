import { readFileSync, writeFileSync } from 'fs';
import type { ExtractedLink, TransformResult, LinksmithConfig, NetworkPlugin, AffiliateLink } from '../../types.js';
import slugify from 'slugify';

export class Transformer {
  private config: LinksmithConfig;
  private plugins: Map<string, NetworkPlugin>;

  constructor(config: LinksmithConfig, plugins: NetworkPlugin[] = []) {
    this.config = config;
    this.plugins = new Map(plugins.map(p => [p.name, p]));
  }

  /**
   * Transform links in a file to use tracking URLs
   */
  transformFile(
    filePath: string,
    links: ExtractedLink[],
    linkMap: Map<string, AffiliateLink>
  ): TransformResult {
    const originalContent = readFileSync(filePath, 'utf-8');
    let transformedContent = originalContent;
    const changes: TransformResult['changes'] = [];

    // Sort links by position (descending) to avoid offset issues when replacing
    const sortedLinks = [...links].sort((a, b) => {
      if (a.line !== b.line) return b.line - a.line;
      return b.column - a.column;
    });

    for (const link of sortedLinks) {
      // Skip internal links
      if (!link.url.startsWith('http')) continue;

      // Find or generate the slug for this link
      const slug = this.findOrGenerateSlug(link, linkMap);
      const trackingUrl = `${this.config.tracking.baseUrl}${slug}`;

      // Replace the URL in the content
      const escaped = this.escapeRegex(link.url);
      const urlPattern = new RegExp(`\\]\\(${escaped}\\)`, 'g');

      const beforeReplace = transformedContent;
      transformedContent = transformedContent.replace(urlPattern, `](${trackingUrl})`);

      if (transformedContent !== beforeReplace) {
        changes.push({
          original: link.url,
          slug,
          trackingUrl,
        });
      }
    }

    return {
      file: filePath,
      originalContent,
      transformedContent,
      linksTransformed: changes.length,
      changes,
    };
  }

  /**
   * Transform multiple files
   */
  transformFiles(
    fileLinks: Map<string, ExtractedLink[]>,
    linkMap: Map<string, AffiliateLink>
  ): TransformResult[] {
    const results: TransformResult[] = [];

    for (const [filePath, links] of fileLinks) {
      const result = this.transformFile(filePath, links, linkMap);
      if (result.linksTransformed > 0) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Write transformed content to files
   */
  applyTransforms(results: TransformResult[]): void {
    for (const result of results) {
      writeFileSync(result.file, result.transformedContent, 'utf-8');
    }
  }

  /**
   * Generate a link map from extracted links for use with Supabase sync
   */
  generateLinkMap(links: ExtractedLink[]): Map<string, AffiliateLink> {
    const map = new Map<string, AffiliateLink>();
    const usedSlugs = new Set<string>();

    for (const link of links) {
      if (!link.url.startsWith('http')) continue;

      // Skip if we already have this URL
      if (map.has(link.url)) continue;

      // Generate a unique slug
      let baseSlug = this.generateSlug(link);
      let slug = baseSlug;
      let counter = 1;

      // If slug is already used, add a domain or numeric suffix
      while (usedSlugs.has(slug)) {
        // Try adding domain first
        try {
          const url = new URL(link.url);
          const domain = url.hostname.replace('www.', '').split('.')[0];
          const domainSlug = `${baseSlug}-${domain}`;
          if (!usedSlugs.has(domainSlug)) {
            slug = domainSlug;
            break;
          }
        } catch {
          // ignore
        }
        // Fall back to numeric suffix
        slug = `${baseSlug}-${++counter}`;
      }

      usedSlugs.add(slug);

      // Get the converted URL if it's an affiliate link
      let finalUrl = link.url;
      if (link.network) {
        const plugin = this.plugins.get(link.network);
        const networkConfig = (this.config.networks as any)[link.network];
        if (plugin && networkConfig?.enabled) {
          finalUrl = plugin.convert(link.url, {
            tag: networkConfig.tag,
            cleanParams: networkConfig.cleanParams ?? true,
          });
        }
      }

      map.set(link.url, {
        slug,
        name: link.text || link.url,
        url: finalUrl,
        is_affiliate: link.isAffiliate,
        network: link.network,
      });
    }

    return map;
  }

  private findOrGenerateSlug(link: ExtractedLink, linkMap: Map<string, AffiliateLink>): string {
    // Check if we already have a mapping for this URL
    const existing = linkMap.get(link.url);
    if (existing) {
      return existing.slug;
    }

    // Generate a new slug
    return this.generateSlug(link);
  }

  private generateSlug(link: ExtractedLink): string {
    // If there's a network plugin, use it to generate the slug
    if (link.network) {
      const plugin = this.plugins.get(link.network);
      if (plugin) {
        return plugin.generateSlug(link.url, link.text);
      }
    }

    // Default slug generation
    if (link.text && link.text !== link.url) {
      const slug = slugify(link.text, {
        lower: true,
        strict: true,
        trim: true,
      });
      return slug.slice(0, 50).replace(/-+$/, '');
    }

    // Extract domain for fallback slug
    try {
      const url = new URL(link.url);
      const domain = url.hostname.replace('www.', '').split('.')[0];
      const pathPart = url.pathname.split('/').filter(Boolean)[0] || '';
      return slugify(`${domain}-${pathPart}`, {
        lower: true,
        strict: true,
      }).slice(0, 50);
    } catch {
      return `link-${Date.now().toString(36)}`;
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export function createTransformer(config: LinksmithConfig, plugins: NetworkPlugin[] = []): Transformer {
  return new Transformer(config, plugins);
}
