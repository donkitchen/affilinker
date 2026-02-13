import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../../config.js';
import { createScanner } from '../../core/scanner/index.js';
import { createTransformer } from '../../core/transformer/index.js';
import { createSupabaseAdapter } from '../../adapters/supabase.js';
import { createFileSystemAdapter } from '../../adapters/filesystem.js';
import { createAmazonPlugin } from '../../plugins/builtin/index.js';
import type { AffiliateLink, StorageAdapter } from '../../types.js';

export function createSyncCommand(): Command {
  const command = new Command('sync')
    .description('Sync links with database (Supabase or JSON file)')
    .option('-c, --config <path>', 'Path to config file')
    .option('-p, --pattern <glob>', 'Override content include pattern')
    .option('--dry-run', 'Show what would be synced without syncing')
    .option('--json', 'Output results as JSON')
    .action(async (options) => {
      const spinner = ora('Loading configuration...').start();

      try {
        const config = await loadConfig(options.config);

        if (options.pattern) {
          config.content.include = [options.pattern];
        }

        // Get the appropriate storage adapter
        let adapter: StorageAdapter | null = null;

        if (config.storage?.adapter === 'supabase') {
          adapter = createSupabaseAdapter(config);
        } else if (config.storage?.adapter === 'json') {
          adapter = createFileSystemAdapter(config);
        }

        if (!adapter) {
          throw new Error('No storage adapter configured. Set storage.adapter to "supabase" or "json"');
        }

        spinner.text = 'Scanning files for links...';

        // Initialize plugins
        const plugins = [createAmazonPlugin()];

        const scanner = createScanner(config, plugins);
        const result = await scanner.scan();

        spinner.text = 'Generating link map...';

        const transformer = createTransformer(config, plugins);
        const linkMap = transformer.generateLinkMap(result.externalLinks);

        // Convert map to array
        const links: AffiliateLink[] = Array.from(linkMap.values());

        spinner.text = `Fetching existing links from ${adapter.name}...`;

        const existingLinks = await adapter.getLinks();
        const existingSlugs = new Set(existingLinks.map(l => l.slug));

        // Find new links
        const newLinks = links.filter(l => !existingSlugs.has(l.slug));
        const updatedLinks = links.filter(l => existingSlugs.has(l.slug));

        if (options.dryRun) {
          spinner.succeed('Dry run complete');
        } else {
          spinner.text = `Syncing ${links.length} links to ${adapter.name}...`;
          await adapter.upsertLinks(links);
          spinner.succeed(`Synced ${links.length} links to ${adapter.name}`);
        }

        if (options.json) {
          console.log(JSON.stringify({
            adapter: adapter.name,
            totalLinks: links.length,
            newLinks: newLinks.length,
            updatedLinks: updatedLinks.length,
            existingLinks: existingLinks.length,
            links: options.dryRun ? links : undefined,
          }, null, 2));
          return;
        }

        // Pretty print results
        console.log('');
        console.log(chalk.bold('Sync Results:'));
        console.log(`  Storage: ${chalk.cyan(adapter.name)}`);
        console.log(`  Total links: ${chalk.cyan(links.length)}`);
        console.log(`  New links: ${chalk.green(newLinks.length)}`);
        console.log(`  Updated links: ${chalk.yellow(updatedLinks.length)}`);
        console.log(`  Existing (unchanged): ${chalk.dim(existingLinks.length - updatedLinks.length)}`);
        console.log('');

        if (newLinks.length > 0) {
          console.log(chalk.bold.green('New links:'));
          for (const link of newLinks.slice(0, 10)) {
            console.log(`  ${chalk.cyan(link.slug)}: ${chalk.dim(link.name)}`);
          }
          if (newLinks.length > 10) {
            console.log(chalk.dim(`  ... and ${newLinks.length - 10} more`));
          }
          console.log('');
        }

        if (options.dryRun) {
          console.log(chalk.yellow('This was a dry run. No data was synced.'));
          console.log(chalk.yellow('Run without --dry-run to sync data.'));
        }

        console.log('');
      } catch (error) {
        spinner.fail('Sync failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return command;
}
