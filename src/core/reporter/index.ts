import { writeFileSync } from 'fs';
import type { ExtractedLink, AffiliateLink, ReportOptions, NetworkPlugin, LinksmithConfig } from '../../types.js';
import slugify from 'slugify';

export class Reporter {
  private plugins: Map<string, NetworkPlugin>;
  private config?: LinksmithConfig;

  constructor(plugins: NetworkPlugin[] = [], config?: LinksmithConfig) {
    this.plugins = new Map(plugins.map(p => [p.name, p]));
    this.config = config;
  }

  generateReport(
    links: ExtractedLink[],
    options: ReportOptions
  ): string {
    const { format, tableName = 'affiliate_links' } = options;

    // Convert ExtractedLinks to AffiliateLinks for the report
    const affiliateLinks = this.toAffiliateLinks(links);

    switch (format) {
      case 'json':
        return this.toJson(affiliateLinks);
      case 'csv':
        return this.toCsv(affiliateLinks);
      case 'sql':
        return this.toSql(affiliateLinks, tableName);
      case 'markdown':
        return this.toMarkdown(links);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  toAffiliateLinks(links: ExtractedLink[]): AffiliateLink[] {
    const byUrl = new Map<string, AffiliateLink>();
    const usedSlugs = new Set<string>();

    for (const link of links) {
      // Skip internal/relative links
      if (!link.url.startsWith('http')) continue;

      // Skip if we already have this URL
      if (byUrl.has(link.url)) continue;

      // Generate a unique slug
      let baseSlug = this.generateSlug(link);
      let slug = baseSlug;
      let counter = 1;

      // If slug is already used, add a domain or numeric suffix
      while (usedSlugs.has(slug)) {
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
        slug = `${baseSlug}-${++counter}`;
      }

      usedSlugs.add(slug);

      // Convert affiliate URLs if we have config and plugins
      let finalUrl = link.url;
      if (link.network && this.config) {
        const plugin = this.plugins.get(link.network);
        const networkConfig = (this.config.networks as Record<string, any>)[link.network];
        if (plugin && networkConfig?.enabled) {
          finalUrl = plugin.convert(link.url, {
            tag: networkConfig.tag,
            cleanParams: networkConfig.cleanParams ?? true,
          });
        }
      }

      byUrl.set(link.url, {
        slug,
        name: link.text || link.url,
        url: finalUrl,
        is_affiliate: link.isAffiliate,
        network: link.network,
      });
    }

    return Array.from(byUrl.values());
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

  private toJson(links: AffiliateLink[]): string {
    return JSON.stringify(links, null, 2);
  }

  private toCsv(links: AffiliateLink[]): string {
    const headers = ['slug', 'name', 'url', 'is_affiliate', 'network'];
    const rows = links.map(link => [
      this.escapeCsv(link.slug),
      this.escapeCsv(link.name),
      this.escapeCsv(link.url),
      link.is_affiliate ? 'true' : 'false',
      link.network || '',
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private toSql(links: AffiliateLink[], tableName: string): string {
    if (links.length === 0) {
      return '-- No links to insert';
    }

    const values = links.map(link => {
      const name = link.name.replace(/'/g, "''");
      const url = link.url.replace(/'/g, "''");
      const network = link.network ? `'${link.network}'` : 'NULL';

      return `  ('${link.slug}', '${name}', '${url}', ${link.is_affiliate}, ${network})`;
    });

    return `INSERT INTO ${tableName} (slug, name, url, is_affiliate, network)
VALUES
${values.join(',\n')}
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  url = EXCLUDED.url,
  is_affiliate = EXCLUDED.is_affiliate,
  network = EXCLUDED.network;`;
  }

  private toMarkdown(links: ExtractedLink[]): string {
    const lines: string[] = [
      '# Link Report',
      '',
      `Total links found: ${links.length}`,
      '',
      '## Links by File',
      '',
    ];

    // Group by file
    const byFile = new Map<string, ExtractedLink[]>();
    for (const link of links) {
      const existing = byFile.get(link.file) || [];
      existing.push(link);
      byFile.set(link.file, existing);
    }

    for (const [file, fileLinks] of byFile) {
      const shortPath = file.split('/').slice(-3).join('/');
      lines.push(`### ${shortPath}`);
      lines.push('');

      for (const link of fileLinks) {
        const affiliate = link.isAffiliate ? ' (affiliate)' : '';
        const network = link.network ? ` [${link.network}]` : '';
        lines.push(`- Line ${link.line}: [${link.text}](${link.url})${affiliate}${network}`);
      }
      lines.push('');
    }

    // Summary section
    const affiliateCount = links.filter(l => l.isAffiliate).length;
    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total links: ${links.length}`);
    lines.push(`- Affiliate links: ${affiliateCount}`);
    lines.push(`- Regular links: ${links.length - affiliateCount}`);
    lines.push(`- Files scanned: ${byFile.size}`);

    return lines.join('\n');
  }

  writeReport(content: string, outputPath: string): void {
    writeFileSync(outputPath, content, 'utf-8');
  }
}

export function createReporter(plugins: NetworkPlugin[] = [], config?: LinksmithConfig): Reporter {
  return new Reporter(plugins, config);
}
