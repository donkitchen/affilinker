import { readFileSync } from 'fs';
import { glob } from 'glob';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { visit } from 'unist-util-visit';
import type { ExtractedLink, ScanResult, LinksmithConfig, NetworkPlugin } from '../../types.js';

interface MarkdownLink {
  type: 'link';
  url: string;
  children: Array<{ type: string; value?: string }>;
  position?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export class Scanner {
  private config: LinksmithConfig;
  private plugins: NetworkPlugin[];

  constructor(config: LinksmithConfig, plugins: NetworkPlugin[] = []) {
    this.config = config;
    this.plugins = plugins;
  }

  async scan(): Promise<ScanResult> {
    const files = await this.getFiles();
    const allLinks: ExtractedLink[] = [];

    for (const file of files) {
      const links = await this.scanFile(file);
      allLinks.push(...links);
    }

    const externalLinks = allLinks.filter(link => this.isExternalLink(link.url));
    const affiliateLinks = externalLinks.filter(link => link.isAffiliate);

    return {
      files: files.length,
      links: allLinks,
      affiliateLinks,
      externalLinks,
    };
  }

  async getFiles(): Promise<string[]> {
    const { include, exclude } = this.config.content;

    const files = await glob(include, {
      ignore: exclude,
      absolute: true,
    });

    return files;
  }

  async scanFile(filePath: string): Promise<ExtractedLink[]> {
    const content = readFileSync(filePath, 'utf-8');
    const links: ExtractedLink[] = [];

    // Parse with remark and MDX support
    const processor = unified()
      .use(remarkParse)
      .use(remarkMdx);

    try {
      const tree = processor.parse(content);

      visit(tree, 'link', (node: MarkdownLink) => {
        const url = node.url;
        const text = this.extractLinkText(node);
        const position = node.position;

        const networkInfo = this.detectNetwork(url);

        links.push({
          url,
          text,
          file: filePath,
          line: position?.start.line ?? 0,
          column: position?.start.column ?? 0,
          isAffiliate: networkInfo.isAffiliate,
          network: networkInfo.network,
        });
      });

      // Also extract links from JSX elements (for MDX)
      visit(tree, 'mdxJsxFlowElement', (node: any) => {
        this.extractJsxLinks(node, filePath, links);
      });

      visit(tree, 'mdxJsxTextElement', (node: any) => {
        this.extractJsxLinks(node, filePath, links);
      });
    } catch (error) {
      // If MDX parsing fails, fall back to regex extraction
      const regexLinks = this.extractLinksWithRegex(content, filePath);
      links.push(...regexLinks);
    }

    return links;
  }

  private extractLinkText(node: MarkdownLink): string {
    const textParts: string[] = [];

    for (const child of node.children) {
      if (child.type === 'text' && child.value) {
        textParts.push(child.value);
      }
    }

    return textParts.join('') || node.url;
  }

  private extractJsxLinks(node: any, filePath: string, links: ExtractedLink[]): void {
    if (node.name === 'a' || node.name === 'AffiliateLink') {
      const hrefAttr = node.attributes?.find((attr: any) =>
        attr.name === 'href' || attr.name === 'url'
      );

      if (hrefAttr?.value) {
        const url = typeof hrefAttr.value === 'string'
          ? hrefAttr.value
          : hrefAttr.value?.value;

        if (url) {
          const networkInfo = this.detectNetwork(url);
          links.push({
            url,
            text: this.extractJsxText(node) || url,
            file: filePath,
            line: node.position?.start.line ?? 0,
            column: node.position?.start.column ?? 0,
            isAffiliate: networkInfo.isAffiliate || node.name === 'AffiliateLink',
            network: networkInfo.network,
          });
        }
      }
    }
  }

  private extractJsxText(node: any): string {
    if (!node.children) return '';

    return node.children
      .filter((child: any) => child.type === 'text')
      .map((child: any) => child.value)
      .join('');
  }

  private extractLinksWithRegex(content: string, filePath: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    const lines = content.split('\n');

    // Markdown link pattern: [text](url)
    const mdLinkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;

    // HTML/JSX href pattern
    const hrefPattern = /href=["']([^"']+)["']/g;

    lines.forEach((line, lineIndex) => {
      let match;

      // Extract markdown links
      while ((match = mdLinkPattern.exec(line)) !== null) {
        const [, text, url] = match;
        const networkInfo = this.detectNetwork(url);

        links.push({
          url,
          text: text || url,
          file: filePath,
          line: lineIndex + 1,
          column: match.index + 1,
          isAffiliate: networkInfo.isAffiliate,
          network: networkInfo.network,
        });
      }

      // Extract href links
      while ((match = hrefPattern.exec(line)) !== null) {
        const url = match[1];
        const networkInfo = this.detectNetwork(url);

        links.push({
          url,
          text: url,
          file: filePath,
          line: lineIndex + 1,
          column: match.index + 1,
          isAffiliate: networkInfo.isAffiliate,
          network: networkInfo.network,
        });
      }
    });

    return links;
  }

  private detectNetwork(url: string): { isAffiliate: boolean; network?: string } {
    for (const plugin of this.plugins) {
      if (plugin.detect(url)) {
        return { isAffiliate: true, network: plugin.name };
      }
    }

    return { isAffiliate: false };
  }

  private isExternalLink(url: string): boolean {
    // Skip relative links, anchors, and internal paths
    if (url.startsWith('/') || url.startsWith('#') || url.startsWith('.')) {
      return false;
    }

    // Skip mailto and tel links
    if (url.startsWith('mailto:') || url.startsWith('tel:')) {
      return false;
    }

    // Check if it's actually a URL
    try {
      const parsed = new URL(url);
      const siteHost = new URL(this.config.siteUrl).hostname;
      return parsed.hostname !== siteHost;
    } catch {
      return false;
    }
  }
}

export function createScanner(config: LinksmithConfig, plugins: NetworkPlugin[] = []): Scanner {
  return new Scanner(config, plugins);
}
