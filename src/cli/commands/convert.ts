import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../../config.js';
import { createScanner } from '../../core/scanner/index.js';
import { createConverter } from '../../core/converter/index.js';
import { createAmazonPlugin } from '../../plugins/builtin/index.js';

export function createConvertCommand(): Command {
  const command = new Command('convert')
    .description('Convert affiliate links to clean format with proper tags')
    .option('-c, --config <path>', 'Path to config file')
    .option('-p, --pattern <glob>', 'Override content include pattern')
    .option('--json', 'Output results as JSON')
    .option('--network <name>', 'Only convert links from specific network')
    .action(async (options) => {
      const spinner = ora('Loading configuration...').start();

      try {
        const config = await loadConfig(options.config);

        if (options.pattern) {
          config.content.include = [options.pattern];
        }

        spinner.text = 'Scanning for affiliate links...';

        // Initialize plugins
        const plugins = [createAmazonPlugin()];

        const scanner = createScanner(config, plugins);
        const result = await scanner.scan();

        spinner.text = 'Converting links...';

        const converter = createConverter(config, plugins);

        // Filter links if network specified
        let linksToConvert = result.affiliateLinks;
        if (options.network) {
          linksToConvert = linksToConvert.filter(l => l.network === options.network);
        }

        const conversions = converter.convertAll(linksToConvert);

        spinner.succeed(`Converted ${conversions.length} links`);

        if (options.json) {
          console.log(JSON.stringify(conversions, null, 2));
          return;
        }

        // Pretty print results
        console.log('');
        console.log(chalk.bold('Conversion Results:'));
        console.log(`  Links converted: ${chalk.cyan(conversions.length)}`);
        console.log('');

        for (const conversion of conversions) {
          console.log(chalk.yellow(`[${conversion.network}]`));
          console.log(`  Original: ${chalk.dim(conversion.original)}`);
          console.log(`  Converted: ${chalk.green(conversion.converted)}`);
          if (conversion.tag) {
            console.log(`  Tag: ${chalk.cyan(conversion.tag)}`);
          }
          console.log('');
        }

      } catch (error) {
        spinner.fail('Conversion failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return command;
}
