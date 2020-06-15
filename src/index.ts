import path from 'path';
import chalk from 'chalk';
import yargs = require('yargs');
import { Parser } from './parser/parser';
import { Commands } from './parser/commands';

const argv = yargs
  .command('$0 <entry>', '', (yargs) =>
    yargs.positional('entry', {
      type: 'string',
      demandOption: true,
      description: 'Path to server entry point',
    })
  )
  .options({
    print: { type: 'boolean', description: 'Print endpoints to console' },
    postman: { type: 'string', description: 'Name of the postman collection to generate' },
    decorator: { type: 'string', description: 'Path to the typescript validator decorator to generate' },
  })
  .usage('Usage: $0 </path/to/server.ts> [--print] [--postman <val>]')
  .example(
    '$0 ~/projects/my-api/src/server.ts --print',
    'Prints all endpoints with their query params, headers and body for my-api'
  )
  .example('$0 ~/projects/my-api/src/server.ts --postman "My API v1"', 'Generates a postman collection for my-api')
  .example(
    '$0 ~/projects/my-api/src/server.ts --decorator "/my-api/src/validators/route-types.generated.ts"',
    'Generates a typescript file exporting a dictionary of endpoints and the request body type'
  ).argv;

const entryPath = path.resolve(argv.entry);

console.log(`Parsing entry point ${chalk.yellow.bold(entryPath)}`);
const parser = new Parser(entryPath);
const endpoints = parser.parse();
console.log(`Found ${chalk.yellow.bold(endpoints.length)} endpoints`);

if (argv.print || (!argv.print && !argv.postman)) {
  Commands.printEndpoints(endpoints);
}

if (argv.postman) {
  Commands.generatePostmanCollection(argv.postman, endpoints);
}

if (argv.decorator) {
  Commands.generateValidateDecorator(argv.decorator, endpoints);
}