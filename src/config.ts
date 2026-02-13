import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import type { LinksmithConfig } from './types.js';

const CONFIG_FILES = [
  'affilinker.config.js',
  'affilinker.config.mjs',
  'affilinker.config.cjs',
  // Legacy support
  'linksmith.config.js',
  'linksmith.config.mjs',
  'linksmith.config.cjs',
];

const DEFAULT_CONFIG: LinksmithConfig = {
  content: {
    include: ['**/*.md', '**/*.mdx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  },
  siteUrl: 'http://localhost:3000',
  tracking: {
    baseUrl: '/link/',
    slugStrategy: 'auto',
  },
  networks: {
    amazon: {
      enabled: true,
      tag: '',
      cleanParams: true,
    },
  },
};

export async function loadConfig(configPath?: string): Promise<LinksmithConfig> {
  const cwd = process.cwd();

  // If explicit config path provided, use it
  if (configPath) {
    const absolutePath = resolve(cwd, configPath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Config file not found: ${absolutePath}`);
    }
    return loadConfigFile(absolutePath);
  }

  // Search for config file
  for (const filename of CONFIG_FILES) {
    const filePath = resolve(cwd, filename);
    if (existsSync(filePath)) {
      return loadConfigFile(filePath);
    }
  }

  // Return default config if no file found
  console.warn('No config file found, using defaults');
  return DEFAULT_CONFIG;
}

async function loadConfigFile(filePath: string): Promise<LinksmithConfig> {
  try {
    // Use dynamic import for ES modules
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);
    const config = module.default || module;

    // Merge with defaults
    return mergeConfig(DEFAULT_CONFIG, config);
  } catch (error) {
    throw new Error(`Failed to load config file: ${filePath}\n${error}`);
  }
}

function mergeConfig(defaults: LinksmithConfig, overrides: Partial<LinksmithConfig>): LinksmithConfig {
  return {
    content: {
      ...defaults.content,
      ...overrides.content,
    },
    siteUrl: overrides.siteUrl || defaults.siteUrl,
    tracking: {
      ...defaults.tracking,
      ...overrides.tracking,
    },
    networks: {
      ...defaults.networks,
      ...overrides.networks,
    },
    storage: overrides.storage,
  };
}

export function validateConfig(config: LinksmithConfig): string[] {
  const errors: string[] = [];

  if (!config.content.include.length) {
    errors.push('content.include must have at least one pattern');
  }

  if (!config.siteUrl) {
    errors.push('siteUrl is required');
  }

  if (!config.tracking.baseUrl) {
    errors.push('tracking.baseUrl is required');
  }

  return errors;
}
