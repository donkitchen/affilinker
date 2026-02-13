import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../../config.js';
import { createScanner } from '../../core/scanner/index.js';
import { createAmazonPlugin } from '../../plugins/builtin/index.js';

export function createScanCommand(): Command {
  const command = new Command('scan')
    .description('Scan content files for outbound links')
    .option('-c, --config <path>', 'Path to config file')
    .option('-p, --pattern <glob>', 'Override content include pattern')
    .option('--json', 'Output results as JSON')
    .option('--affiliate-only', 'Only show affiliate links')
    .option('--external-only', 'Only show external links')
    .action(async (options) => {
      const spinner = ora('Loading configuration...').start();

      try {
        const config = await loadConfig(options.config);

        if (options.pattern) {
          config.content.include = [options.pattern];
        }

        spinner.text = 'Scanning files for links...';

        // Initialize plugins
        const plugins = [createAmazonPlugin()];

        const scanner = createScanner(config, plugins);
        const result = await scanner.scan();

        spinner.succeed(`Scanned ${result.files} files`);

        // Filter results based on options
        let linksToShow = result.externalLinks;
        if (options.affiliateOnly) {
          linksToShow = result.affiliateLinks;
        }

        if (options.json) {
          console.log(JSON.stringify({
            files: result.files,
            totalLinks: result.links.length,
            externalLinks: result.externalLinks.length,
            affiliateLinks: result.affiliateLinks.length,
            links: linksToShow,
          }, null, 2));
          return;
        }

        // Pretty print results
        console.log('');
        console.log(chalk.bold('Scan Results:'));
        console.log(`  Total files scanned: ${chalk.cyan(result.files)}`);
        console.log(`  Total links found: ${chalk.cyan(result.links.length)}`);
        console.log(`  External links: ${chalk.cyan(result.externalLinks.length)}`);
        console.log(`  Affiliate links: ${chalk.green(result.affiliateLinks.length)}`);
        console.log('');

        // Group by file
        const byFile = new Map<string, typeof linksToShow>();
        for (const link of linksToShow) {
          const existing = byFile.get(link.file) || [];
          existing.push(link);
          byFile.set(link.file, existing);
        }

        for (const [file, links] of byFile) {
          const shortPath = file.split('/').slice(-3).join('/');
          console.log(chalk.bold.blue(`\n${shortPath}:`));

          for (const link of links) {
            const networkTag = link.network
              ? chalk.yellow(` [${link.network}]`)
              : '';
            const affiliateTag = link.isAffiliate
              ? chalk.green(' (affiliate)')
              : '';
            console.log(`  Line ${link.line}: ${chalk.dim(link.text)}`);
            console.log(`    ${chalk.cyan(link.url)}${networkTag}${affiliateTag}`);
          }
        }

        console.log('');
      } catch (error) {
        spinner.fail('Scan failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return command;
}
