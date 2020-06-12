import ts, { Type } from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import { Endpoint } from '../models/endpoint';
import { FieldType, ObjectParameters } from '../models/type';

const getDefaultEndpoint: () => Endpoint = () => ({
  path: '',
  type: '',
  body: {},
  query: {},
  headers: {
    'content-type': { type: 'string' },
  },
});

export class Parser {
  private program: ts.Program;
  private checker: ts.TypeChecker;
  private source: ts.SourceFile;
  private printer: ts.Printer;

  constructor(private entryPath: string) {
    this.program = ts.createProgram([entryPath], {});
    this.checker = this.program.getTypeChecker();
    this.source = this.program.getSourceFile(entryPath)!;
    this.printer = ts.createPrinter();
  }

  private getMemberTypeName(memberType: ts.Type, nodeLocation: ts.Node): FieldType | null {
    // PRIMITIVE: memberType.intrinsicName
    if ((memberType as any).intrinsicName) {
      return {
        type: (memberType as any).intrinsicName,
      };
    }

    if (memberType.symbol) {
      let compoundType: { [key: string]: any } = {};

      if (memberType.symbol.name == 'Array' && (<ts.TypeReference>memberType).typeArguments) {
        // ARRAY
        let elementType = (<ts.TypeReference>memberType).typeArguments![0];
        return {
          type: 'array',
          items: this.getMemberTypeName(elementType, nodeLocation),
        };
      } else if (memberType.symbol.exports) {
        // ENUM: memberType.symbol.exports
        memberType.symbol.exports.forEach((value, key) => {
          const valueType = this.checker.getTypeOfSymbolAtLocation(value, nodeLocation);
          compoundType[key.toString()] = this.getMemberTypeName(valueType, nodeLocation);
        });
      } else if (memberType.symbol.members) {
        // OBJECT: memberType.symbol.members
        memberType.symbol.members.forEach((value, key) => {
          const valueType = this.checker.getTypeOfSymbolAtLocation(value, nodeLocation);
          compoundType[key.toString()] = this.getMemberTypeName(valueType, nodeLocation);
        });
      } else if ((memberType.symbol.valueDeclaration as any)?.initializer) {
        // ENUM VALUE
        const initializerToken = (memberType.symbol.valueDeclaration as any)?.initializer;
        if (initializerToken.text) {
          return {
            type: 'string',
            value: initializerToken.text,
          };
        }
      }

      // TODO: 1) Treat case where type is something like "a" | "b" | "c"
      // TODO: 2) Treat case where type is optional (user?: User)

      return { type: 'object', properties: compoundType };
    }

    return null;
  }

  private extractParams(variableName: string, propertyName: string, body: ts.Node) {
    const params: { [key: string]: FieldType } = {};

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
        params[field] = {
          type: 'string',
        };
      }

      //EX:        req.body.email
      const children = (node.parent.parent as any)._children;
      const rightFieldName =
        children.length > 2 && children[2].kind == ts.SyntaxKind.Identifier ? children[2].getText() : null;
      const typeSymbol =
        children[0].elements?.length > 0
          ? (this.checker.getTypeAtLocation(children[0].elements[0]) as any).intrinsicName
          : null;
      if (rightFieldName) {
        params[rightFieldName] = { type: typeSymbol || 'string' };
      }
      // console.log(node);
    }

    return params;
  }

  private delint(sourceFile: ts.SourceFile, endpoint: Endpoint, found: Endpoint[]) {
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
      const newEndpoint = { ...getDefaultEndpoint(), path: endpoint.path };
      newEndpoint.path += path.replace(/['"]+/g, '');

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

        let symbol = this.checker.getSymbolAtLocation(toExpandNode);
        if (newEndpoint.type && symbol) {
          const symbolType = this.checker.getTypeOfSymbolAtLocation(symbol, expresion);
          const declaration = symbolType.symbol.declarations[0]! as ts.SignatureDeclaration;
          const signature = this.checker.getSignatureFromDeclaration(declaration);

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

          let bodyParams: ObjectParameters = {};
          let queryParams: ObjectParameters = {};
          let headerParams: ObjectParameters = {};

          const requestNode = declaration.parameters[0];
          const requestName = (requestNode.name as ts.Identifier).escapedText;
          const requestType: Type = this.checker.getTypeAtLocation(requestNode);
          const typeArgs = (requestType as any).typeArguments;
          if (typeArgs && typeArgs.length >= 3) {
            const bodyType = typeArgs[2].symbol?.members;
            if (bodyType) {
              for (const member of bodyType) {
                const key = member[0];
                const symbol = member[1];
                const symbolType: any = this.checker.getTypeOfSymbolAtLocation(symbol, requestNode);
                bodyParams[key] = this.getMemberTypeName(symbolType, requestNode);
              }
            }
          }

          // const responseName = (declaration.parameters[1].name as ts.Identifier).escapedText;
          // const returnType = this.checker.getReturnTypeOfSignature(signature!);
          // console.log(declaration.parameters);

          const arrowF = declaration as ts.ArrowFunction;

          if (Object.keys(bodyParams).length == 0) {
            bodyParams = this.extractParams(requestName.toString(), 'body', arrowF.body);
          }
          for (const key in bodyParams) {
            newEndpoint.body[key] = bodyParams[key];
          }

          queryParams = this.extractParams(requestName.toString(), 'query', arrowF.body);
          for (const key in queryParams) {
            newEndpoint.query[key] = bodyParams[key];
          }

          headerParams = this.extractParams(requestName.toString(), 'headers', arrowF.body);
          for (const key in headerParams) {
            newEndpoint.headers[key] = headerParams[key];
          }
        } else {
          if (symbol) symbol = this.checker.getAliasedSymbol(symbol);
          if (symbol) {
            const declaration = symbol!.declarations[0]!;
            // console.log(declaration.getText());
            const newSourceFile = declaration.getSourceFile();
            this.delint(newSourceFile, newEndpoint, found);
          }
        }
      }
    }
  }

  public parse(): Endpoint[] {
    const endpoints: Endpoint[] = [];
    this.delint(this.source, getDefaultEndpoint(), endpoints);
    return endpoints;
  }
}
