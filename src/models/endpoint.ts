import ts from 'typescript';

export interface Endpoint {
  type: string;
  path: string;
  query: { [key: string]: any };
  body: { [key: string]: any };
  headers: { [key: string]: any };
  methodName?: string;
  jsdoc?: {
    [key: string]: string;
  };
  return_?: string;
}

export interface NewEndpoint {
  path: string;
  node: ts.Node;
}
