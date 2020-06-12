import ts from 'typescript';
import { ObjectParameters } from './type';

export interface Endpoint {
  type: string;
  path: string;
  query: ObjectParameters;
  body: ObjectParameters;
  headers: ObjectParameters;
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
