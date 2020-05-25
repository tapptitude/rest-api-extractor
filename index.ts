import path from 'path';
import ts from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';

const filePath = path.resolve(process.argv.slice(2)[0]!);

console.log(filePath);
const program = ts.createProgram([filePath], {});
const checker = program.getTypeChecker();
const source = program.getSourceFile(filePath)!;
const printer = ts.createPrinter();


interface Endpoint {
    type: string;
    path: string;
    query: {[key: string]: any};
    body: {[key: string]: any};
    return_?: string;
}

interface NewEndpoint {
    path: string;
    node: ts.Node;
}

export function extractParams(variableName: string, propertyName: string, body: ts.Node) {
    const params: {[key: string]: any} = {}

    //EX:        const { email, password } = req.body;
    const propertyAccess = tsquery.parse(`PropertyAccessExpression > Identifier[name="${variableName}"] ~ Identifier[name="${propertyName}"]`);
    let propertyAccessNodes = tsquery.match(body, propertyAccess, {visitAllChildren: true});
    for (const node of propertyAccessNodes) {
        // @ts-ignore
        //EX:        const { email, password } = req.body;
        const leftFields = node.parent.parent._children[0].elements?.map(item => item.getText())
        for (const field of leftFields || []) {
            params[field] = 'string';
        }

        //EX:        req.body.email
        // @ts-ignore
        const children = node.parent.parent._children
        // @ts-ignore
        const rightFieldName = children.length > 2 && children[2].kind == ts.SyntaxKind.Identifier ? children[2].getText() : null;
        if (rightFieldName) {
            params[rightFieldName] = 'string';
        }
        // console.log(node);
    }

    return params
}

export function delint(sourceFile: ts.SourceFile, endpoint: Endpoint, found: Endpoint[]) {
    const nodes = tsquery(sourceFile, ':matches(' +
        'CallExpression[expression.name.name="use"], CallExpression[expression.name.name="get"], ' +
        'CallExpression[expression.name.name="put"], CallExpression[expression.name.name="post"], ' +
        'CallExpression[expression.name.name="delete"], CallExpression[expression.name.name="patch"])');
    const types = ['get', 'put', 'post', 'delete', 'patch'];

    for (let node of nodes) {
        const expresion = node as ts.CallExpression
        if (expresion.arguments.length < 2) {
            continue
        }
        const path = expresion.arguments[0].getText();
        const newEndpoint = {...endpoint};
        newEndpoint.path += path.replace(/['"]+/g, '');
        newEndpoint.body = {};
        newEndpoint.query = {};

        // @ts-ignore
        const type: string = expresion.expression.name?.escapedText
        if (types.includes(type)) {
            newEndpoint.type = type;
            found.push(newEndpoint);
        }

        for (let i = 1; i < expresion.arguments.length; i++) {
            const toExpandNode = expresion.arguments[i];
            // console.log(path, toExpandNode.getText()); // print endpoint and function name

            let symbol = checker.getSymbolAtLocation(toExpandNode)
            if (newEndpoint.type && symbol) {
                const symbolType = checker.getTypeOfSymbolAtLocation(symbol, expresion);
                const declaration = symbolType.symbol.declarations[0]! as ts.SignatureDeclaration;
                const signature = checker.getSignatureFromDeclaration(declaration);

                const requestName = (declaration.parameters[0].name as ts.Identifier).escapedText;
                const responseName = (declaration.parameters[1].name as ts.Identifier).escapedText;
                const returnType = checker.getReturnTypeOfSignature(signature!);
                // console.log(declaration.parameters);
                const arrowF = declaration as ts.ArrowFunction
                const bodyParams = extractParams(requestName.toString(), 'body', arrowF.body);
                for (const key in bodyParams) {
                    newEndpoint.body[key] = bodyParams[key];
                }
                const queryParams = extractParams(requestName.toString(), 'query', arrowF.body);
                for (const key in queryParams) {
                    newEndpoint.query[key] = bodyParams[key];
                }
            } else {
                if (symbol) symbol = checker.getAliasedSymbol(symbol);
                if (symbol) {
                    const declaration = symbol!.declarations[0]!
                    // console.log(declaration.getText());

                    const newSourceFile = declaration.getSourceFile();
                    delint(newSourceFile, newEndpoint, found);
                }
            }
        }
    }
}

const found: Endpoint[] = [];
delint(source, {path: '', type: '', body: {}, query: {}}, found)

const paths = found.map((item) => {
    let path = item.type + ' ' + item.path;

    const queryKeys = Object.keys(item.query);
    if (queryKeys.length) {
        path +=  ' query: ' + queryKeys;
    }

    const bodyKeys = Object.keys(item.body);
    if (bodyKeys.length) {
        path +=  ' body: ' + bodyKeys;
    }
    return path;
})
console.log(paths);



