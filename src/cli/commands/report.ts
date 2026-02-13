import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../../config.js';
import { createScanner } from '../../core/scanner/index.js';
import { createReporter } from '../../core/reporter/index.js';
import { createAmazonPlugin } from '../../plugins/builtin/index.js';

export function createReportCommand(): Command {
  const command = new Command('report')
    .description('Generate reports of scanned links')
    .option('-c, --config <path>', 'Path to config file')
    .option('-p, --pattern <glob>', 'Override content include pattern')
    .option('-f, --format <type>', 'Output format: json, csv, sql, markdown', 'json')
    .option('-o, --output <path>', 'Output file path (prints to stdout if not specified)')
    .option('-t, --table <name>', 'Table name for SQL output', 'affiliate_links')
    .option('--affiliate-only', 'Only include affiliate links')
    .option('--external-only', 'Only include external links')
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

        spinner.text = 'Generating report...';

        // Filter results based on options
        let linksToReport = result.externalLinks;
        if (options.affiliateOnly) {
          linksToReport = result.affiliateLinks;
        }

        const reporter = createReporter(plugins, config);
        const report = reporter.generateReport(linksToReport, {
          format: options.format,
          tableName: options.table,
        });

        spinner.succeed(`Generated ${options.format} report`);

        if (options.output) {
          reporter.writeReport(report, options.output);
          console.log(chalk.green(`Report written to: ${options.output}`));
        } else {
          console.log('');
          console.log(report);
        }

      } catch (error) {
        spinner.fail('Report generation failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return command;
}
