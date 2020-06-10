import path from 'path';
import ts from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import { Endpoint } from './models/endpoint';
import { postmanUtils } from './utils/postman-utils';
import chalk from 'chalk';
import yargs = require('yargs');

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

const serverEntryPath = argv.entry;

const filePath = path.resolve(serverEntryPath);
console.log(`Parsing entry point ${chalk.yellow.bold(filePath)}`);

const program = ts.createProgram([filePath], {});
const checker = program.getTypeChecker();
const source = program.getSourceFile(filePath)!;
const printer = ts.createPrinter();

export function extractParams(variableName: string, propertyName: string, body: ts.Node) {
  const params: { [key: string]: any } = {};

  //EX:        const { email, password } = req.body;
  const propertyAccess = tsquery.parse(
    `PropertyAccessExpression > Identifier[name="${variableName}"] ~ Identifier[name="${propertyName}"]`
  );
  let propertyAccessNodes = tsquery.match(body, propertyAccess, {
    visitAllChildren: true,
  });
  for (const node of propertyAccessNodes) {
    // @ts-ignore
    //EX:        const { email, password } = req.body;
    const leftFields = node.parent.parent._children[0].elements?.map((item) => item.getText());
    for (const field of leftFields || []) {
      params[field] = 'string';
    }

    //EX:        req.body.email
    // @ts-ignore
    const children = node.parent.parent._children;
    // @ts-ignore
    const rightFieldName =
      children.length > 2 && children[2].kind == ts.SyntaxKind.Identifier ? children[2].getText() : null;
    if (rightFieldName) {
      params[rightFieldName] = 'string';
    }
    // console.log(node);
  }

  return params;
}

export function delint(sourceFile: ts.SourceFile, endpoint: Endpoint, found: Endpoint[]) {
  const nodes = tsquery(
    sourceFile,
    ':matches(' +
      'CallExpression[expression.name.name="use"], CallExpression[expression.name.name="get"], ' +
      'CallExpression[expression.name.name="put"], CallExpression[expression.name.name="post"], ' +
      'CallExpression[expression.name.name="delete"], CallExpression[expression.name.name="patch"])'
  );
  const types = ['get', 'put', 'post', 'delete', 'patch'];

  for (let node of nodes) {
    const expresion = node as ts.CallExpression;
    if (expresion.arguments.length < 2) {
      continue;
    }
    const path = expresion.arguments[0].getText();
    const newEndpoint = { ...endpoint };
    newEndpoint.path += path.replace(/['"]+/g, '');
    newEndpoint.body = {};
    newEndpoint.query = {};
    newEndpoint.headers = {
      'content-type': 'string',
    };

    // @ts-ignore
    const type: string = expresion.expression.name?.escapedText;
    if (types.includes(type)) {
      newEndpoint.type = type;
      newEndpoint.path = newEndpoint.path.replace('//', '/'); // Remove double / if they exist
      found.push(newEndpoint);
    }

    for (let i = 1; i < expresion.arguments.length; i++) {
      const toExpandNode = expresion.arguments[i];
      // console.log(path, toExpandNode.getText()); // print endpoint and function name

      let symbol = checker.getSymbolAtLocation(toExpandNode);
      if (newEndpoint.type && symbol) {
        const symbolType = checker.getTypeOfSymbolAtLocation(symbol, expresion);
        const declaration = symbolType.symbol.declarations[0]! as ts.SignatureDeclaration;
        const signature = checker.getSignatureFromDeclaration(declaration);

        // Get JsDoc tags if they exist
        const jsdocTags = signature?.getJsDocTags();
        if (jsdocTags && jsdocTags.length > 0) {
          newEndpoint.jsdoc = {};
          jsdocTags.forEach((tag) => {
            newEndpoint.jsdoc![tag.name] = tag.text || '';
          });
        }

        // Set method name for reference (e.g. login, register, changePasswordByEmailToken)
        newEndpoint.methodName = (declaration.parent as any)?.name?.escapedText;

        const requestName = (declaration.parameters[0].name as ts.Identifier).escapedText;
        const responseName = (declaration.parameters[1].name as ts.Identifier).escapedText;
        const returnType = checker.getReturnTypeOfSignature(signature!);
        // console.log(declaration.parameters);
        const arrowF = declaration as ts.ArrowFunction;

        const bodyParams = extractParams(requestName.toString(), 'body', arrowF.body);
        for (const key in bodyParams) {
          newEndpoint.body[key] = bodyParams[key];
        }

        const queryParams = extractParams(requestName.toString(), 'query', arrowF.body);
        for (const key in queryParams) {
          newEndpoint.query[key] = bodyParams[key];
        }

        const headerParams = extractParams(requestName.toString(), 'headers', arrowF.body);
        for (const key in headerParams) {
          newEndpoint.headers[key] = headerParams[key];
        }
      } else {
        if (symbol) symbol = checker.getAliasedSymbol(symbol);
        if (symbol) {
          const declaration = symbol!.declarations[0]!;
          // console.log(declaration.getText());

          const newSourceFile = declaration.getSourceFile();
          delint(newSourceFile, newEndpoint, found);
        }
      }
    }
  }
}

const found: Endpoint[] = [];
delint(source, { path: '', type: '', body: {}, query: {}, headers: { 'content-type': 'string' } }, found);

const paths = found.map((item) => {
  let path = item.type + ' ' + item.path;

  const queryKeys = Object.keys(item.query);
  if (queryKeys.length) {
    path += ' query: ' + queryKeys;
  }

  const bodyKeys = Object.keys(item.body);
  if (bodyKeys.length) {
    path += ' body: ' + bodyKeys;
  }
  return path;
});

console.log(`Found ${chalk.yellow.bold(found.length)} endpoints`);

if (argv.print) {
  console.log(paths);
} else if (argv.postman) {
  console.log(`Generating postman collection`);
  const generatedFilePath = postmanUtils.createCollection({
    collectionName: argv.postman,
    endpoints: found,
  });
  console.log(`Wrote postman collection to ${chalk.yellow.bold(generatedFilePath)}`);
}
