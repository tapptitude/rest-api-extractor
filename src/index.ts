import path from 'path';
import chalk from 'chalk';
import yargs = require('yargs');
import { Parser } from './parser/parser';
import { Commands } from './parser/commands';

const argv = yargs
  .options({
    entry: { type: 'string', demandOption: true, alias: 'e', description: 'Server entry point' },
    print: { type: 'boolean', description: 'Print endpoints to console' },
    postman: { type: 'string', description: 'Name of the postman collection to generate' },
  })
  .usage('Usage: $0 --entry </path/to/server.ts> [--print] [--postman <val>]')
  .example(
    '$0 --entry ~/projects/my-api/src/server.ts --print',
    'Prints all endpoints with their query params, headers and body for my-api'
  )
  .example(
    '$0 --entry ~/projects/my-api/src/server.ts --postman "My API v1"',
    'Generates a postman collection for my-api'
  ).argv;

const entryPath = path.resolve(argv.entry);

console.log(`Parsing entry point ${chalk.yellow.bold(entryPath)}`);
const parser = new Parser(entryPath);
const endpoints = parser.parse();
console.log(`Found ${chalk.yellow.bold(endpoints.length)} endpoints`);

if (argv.print) {
  Commands.printEndpoints(endpoints);
} else if (argv.postman) {
  Commands.generatePostmanCollection(argv.postman, endpoints);
}
