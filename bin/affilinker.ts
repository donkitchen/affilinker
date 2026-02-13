#!/usr/bin/env node

import { Command } from 'commander';
import {
  createScanCommand,
  createConvertCommand,
  createReportCommand,
  createTransformCommand,
  createSyncCommand,
} from '../src/cli/commands/index.js';

const program = new Command();

program
  .name('affilinker')
  .description('CLI tool for managing affiliate and outbound links in content files')
  .version('0.1.0');

// Add commands
program.addCommand(createScanCommand());
program.addCommand(createConvertCommand());
program.addCommand(createReportCommand());
program.addCommand(createTransformCommand());
program.addCommand(createSyncCommand());

program.parse();
