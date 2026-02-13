import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../../config.js';
import { createScanner } from '../../core/scanner/index.js';
import { createTransformer } from '../../core/transformer/index.js';
import { createAmazonPlugin } from '../../plugins/builtin/index.js';

export function createTransformCommand(): Command {
  const command = new Command('transform')
    .description('Transform links in content files to use tracking URLs')
    .option('-c, --config <path>', 'Path to config file')
    .option('-p, --pattern <glob>', 'Override content include pattern')
    .option('--dry-run', 'Show changes without applying them')
    .option('--json', 'Output results as JSON')
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

        spinner.text = 'Generating link map...';

        const transformer = createTransformer(config, plugins);

        // Generate the link map from all external links
        const linkMap = transformer.generateLinkMap(result.externalLinks);

        spinner.text = 'Transforming content files...';

        // Group links by file
        const fileLinks = new Map<string, typeof result.externalLinks>();
        for (const link of result.externalLinks) {
          const existing = fileLinks.get(link.file) || [];
          existing.push(link);
          fileLinks.set(link.file, existing);
        }

        // Transform files
        const transformResults = transformer.transformFiles(fileLinks, linkMap);

        if (options.dryRun) {
          spinner.succeed(`Would transform ${transformResults.length} files (dry run)`);
        } else {
          transformer.applyTransforms(transformResults);
          spinner.succeed(`Transformed ${transformResults.length} files`);
        }

        if (options.json) {
          console.log(JSON.stringify({
            filesTransformed: transformResults.length,
            totalChanges: transformResults.reduce((acc, r) => acc + r.linksTransformed, 0),
            results: transformResults.map(r => ({
              file: r.file,
              linksTransformed: r.linksTransformed,
              changes: r.changes,
            })),
          }, null, 2));
          return;
        }

        // Pretty print results
        console.log('');
        console.log(chalk.bold('Transform Results:'));
        console.log(`  Files transformed: ${chalk.cyan(transformResults.length)}`);
        console.log(`  Total links changed: ${chalk.cyan(transformResults.reduce((acc, r) => acc + r.linksTransformed, 0))}`);
        console.log('');

        for (const result of transformResults) {
          const shortPath = result.file.split('/').slice(-3).join('/');
          console.log(chalk.bold.blue(`\n${shortPath}:`));
          console.log(`  Links transformed: ${result.linksTransformed}`);

          for (const change of result.changes) {
            console.log(`    ${chalk.dim(change.original)}`);
            console.log(`    ${chalk.green('→')} ${chalk.cyan(change.trackingUrl)} (${change.slug})`);
          }
        }

        if (options.dryRun) {
          console.log('');
          console.log(chalk.yellow('This was a dry run. No files were modified.'));
          console.log(chalk.yellow('Run without --dry-run to apply changes.'));
        }

        console.log('');
      } catch (error) {
        spinner.fail('Transform failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return command;
}
