import ts, {BindingElement, ParameterDeclaration, Type} from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import { Endpoint } from '../models/endpoint';
import {FieldType, ObjectParameters} from '../models/type';

const getDefaultEndpoint: () => Endpoint = () => ({
  path: '',
  type: '',
  body: {},
  query: {},
  response: {},
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
        return { type: 'enum', properties: compoundType };
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

      //EX:        const { email, password } = req.body;
      const children = node.parent.parent.getChildren();
      let leftBinding = children[0] as ts.BindingPattern;
      for (const leftField of leftBinding.elements || []) {
        let fieldName = leftField.getText()
        // let typeSymbol = this.checker.typeToString(this.checker.getTypeAtLocation(leftField))
        let typeSymbol = this.getMemberTypeName(this.checker.getTypeAtLocation(leftField), leftField);
        params[fieldName] = {
          type: typeSymbol?.type || 'string',
          ...typeSymbol
        };
      }

      //EX:        req.body.email
      const rightField = children.length > 2 && children[2].kind == ts.SyntaxKind.Identifier ? children[2] : null;
      if (rightField) {
        const rightFieldName = rightField.getText()
        // const typeSymbol = this.checker.typeToString(this.checker.getTypeAtLocation(rightField))
        let typeSymbol = this.getMemberTypeName(this.checker.getTypeAtLocation(rightField), rightField);
        params[rightFieldName] = { type: typeSymbol?.type || 'string', ...typeSymbol };
      }

      // console.log(node);
    }

    return params;
  }

  getObjectParametersFromDeclarationType(declaration: ts.ParameterDeclaration, position: number, expandChiltdTypes: boolean = false) {
    let params: ObjectParameters = {}

    const type: ts.Type = this.checker.getTypeAtLocation(declaration);
    const typeArgs = (type as any).typeArguments;
    if (typeArgs && typeArgs.length > position) {
      let typeArgument = typeArgs[position];
      if (typeArgument.symbol?.name === 'Array') {
        params = {type: this.getMemberTypeName(typeArgument, declaration) };
      } else {
        for (const member of typeArgs[position].symbol?.members || []) {
          const key = member[0];
          const symbol = member[1];
          let isOptional = this.checker.isOptionalParameter(symbol.declarations[0]);
          let fieldName = key; //+ (isOptional ? '?' : '');
          const symbolType: any = this.checker.getTypeOfSymbolAtLocation(symbol, declaration);
          if (expandChiltdTypes) {
            params[fieldName] = this.getMemberTypeName(symbolType, declaration);
          } else {
            params[fieldName] = {type: this.checker.typeToString(symbolType)};
          }
          params[fieldName]!.isOptional = isOptional;
        }
      }
      if (typeArgument.types && typeArgument.types.length > 1) {
        let types = typeArgument.types.map((item: ts.Type) => this.checker.typeToString(item));
        params[''] = {type: types.join(' | ')}
      }
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
        console.log(path, toExpandNode.getText()); // print endpoint and function name
        if (toExpandNode.getText() == "avatarController.getUserAvatar") {
          console.log('test')
        }

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
          let responseParams: ObjectParameters = {};

          // parse request interface parameters
          const requestNode = declaration.parameters[0];
          let requestName = (requestNode.name as ts.Identifier).escapedText;
          bodyParams = this.getObjectParametersFromDeclarationType(requestNode, 2, true)

          // parse response parameters
          const responseNode = declaration.parameters[1];
          responseParams = this.getObjectParametersFromDeclarationType(responseNode, 0)

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

          for (const key in responseParams) {
            newEndpoint.response[key] = responseParams[key];
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
