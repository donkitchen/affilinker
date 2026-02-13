import type { ExtractedLink, ConversionResult, NetworkPlugin, NetworkOptions, LinksmithConfig } from '../../types.js';

export class Converter {
  private config: LinksmithConfig;
  private plugins: Map<string, NetworkPlugin>;

  constructor(config: LinksmithConfig, plugins: NetworkPlugin[] = []) {
    this.config = config;
    this.plugins = new Map(plugins.map(p => [p.name, p]));
  }

  convert(link: ExtractedLink): ConversionResult | null {
    if (!link.network) {
      return null;
    }

    const plugin = this.plugins.get(link.network);
    if (!plugin) {
      return null;
    }

    const networkConfig = this.getNetworkConfig(link.network);
    if (!networkConfig?.enabled) {
      return null;
    }

    const options: NetworkOptions = {
      tag: networkConfig.tag,
      cleanParams: networkConfig.cleanParams ?? true,
    };

    const converted = plugin.convert(link.url, options);

    return {
      original: link.url,
      converted,
      network: link.network,
      tag: networkConfig.tag,
    };
  }

  convertAll(links: ExtractedLink[]): ConversionResult[] {
    const results: ConversionResult[] = [];

    for (const link of links) {
      const result = this.convert(link);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  private getNetworkConfig(network: string): { enabled: boolean; tag?: string; cleanParams?: boolean } | undefined {
    const networks = this.config.networks as Record<string, any>;
    return networks[network];
  }
}

export function createConverter(config: LinksmithConfig, plugins: NetworkPlugin[] = []): Converter {
  return new Converter(config, plugins);
}
