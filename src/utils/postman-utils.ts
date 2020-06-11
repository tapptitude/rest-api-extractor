import { Endpoint } from '../models/endpoint';
import {
  Collection,
  ItemGroup,
  Item,
  Request,
  QueryParamDefinition,
  RequestBody,
  HeaderDefinition,
  RequestAuth,
} from 'postman-collection';
import { writeFileSync, readFileSync } from 'fs';
import path from 'path';
import { TextUtils } from './text-utils';

interface CreateCollectionParams {
  collectionName: string;
  endpoints: Endpoint[];
}

class PostmanUtils {
  queryParamDefaults: { [key: string]: string };
  bodyDefaults: { [key: string]: string };
  headerDefaults: { [key: string]: string };

  constructor() {
    this.queryParamDefaults = JSON.parse(readFileSync('src/config/query-param-defaults.json').toString('utf-8'));
    this.bodyDefaults = JSON.parse(readFileSync('src/config/body-defaults.json').toString('utf-8'));
    this.headerDefaults = JSON.parse(readFileSync('src/config/header-defaults.json').toString('utf-8'));
  }

  private getDefaultValueForQueryParam(param: string): string {
    return this.queryParamDefaults[param] || '';
  }

  private getDefaultValueForBodyProperty(property: string): string {
    return this.bodyDefaults[property] || '';
  }

  private getDefaultValueForHeader(header: string): string {
    return this.headerDefaults[header] || '';
  }

  private buildRequestName(endpoint: Endpoint): string {
    if (endpoint.jsdoc?.name) return endpoint.jsdoc?.name?.toLowerCase();
    if (endpoint.methodName) return TextUtils.humanizeText(endpoint.methodName);

    const parts = endpoint.path.split('/');
    const last = parts[parts.length - 1];
    if (last) {
      if (last.startsWith(':')) {
        return `${TextUtils.httpMethodToVerb(endpoint.type)} by ${last.slice(1)}`;
      }
      return last;
    } else {
      return `${TextUtils.httpMethodToVerb(endpoint.type)} ${parts[parts.length - 2]}`;
    }
  }

  private buildRequest(endpoint: Endpoint): Request {
    const request = new Request({
      method: endpoint.type,
      url: `{{baseUrl}}${endpoint.path}`,
    });

    if (endpoint.query && Object.keys(endpoint.query).length > 0) {
      const params: QueryParamDefinition[] = [];
      Object.keys(endpoint.query).forEach((param) => {
        params.push({
          key: param,
          value: this.getDefaultValueForQueryParam(param),
        });
      });
      request.addQueryParams(params);
    }

    if (endpoint.body && Object.keys(endpoint.body).length > 0) {
      const body: { [key: string]: any } = {};
      Object.keys(endpoint.body).forEach((key) => {
        body[key] = this.getDefaultValueForBodyProperty(key);
      });
      request.body = new RequestBody({
        mode: 'raw',
        raw: JSON.stringify(body, null, '\t'),
      });
    }

    if (endpoint.headers && Object.keys(endpoint.headers).length > 0) {
      Object.keys(endpoint.headers).forEach((header) => {
        if (header == 'authorization') {
          request.auth = new RequestAuth({
            type: 'bearer',
            bearer: [{ key: 'token', value: '{{authToken}}' }],
          });
        } else {
          const hd: HeaderDefinition = {
            key: TextUtils.capitalizeText(header),
            value: this.getDefaultValueForHeader(header),
          };
          request.addHeader(hd);
        }
      });
    }

    return request;
  }

  public createCollection({ collectionName, endpoints }: CreateCollectionParams) {
    // Sort endpoints alphabetically by path
    endpoints = endpoints.sort((e1, e2) => e1.path.localeCompare(e2.path));

    // Create an empty Postman Collection
    const collection = new Collection({
      info: { name: collectionName },
    });

    endpoints.forEach((endpoint) => {
      const pathParts = endpoint.path.slice(1).split('/');
      const lastPartIndex = pathParts.length - 1;

      let currentItems = collection.items;
      pathParts.forEach((part, index) => {
        let node: any;
        const isRequest = index === lastPartIndex;

        if (isRequest) {
          // This is the last node of the path which means it is a Request

          node = new Item({ name: this.buildRequestName(endpoint) });
          (node as Item).request = this.buildRequest(endpoint);
        } else {
          // Current part of path is a "folder", create an ItemGroup

          node = currentItems.find((item) => item.name === part, null);
          // Check if node already exists or it exists but as a request
          // If it is a request with the same name, it doesn't have children (.items)
          if (!node || !(node as ItemGroup<Item>).items) {
            node = new ItemGroup({
              name: part,
            });
          }
        }

        // Add node to parent's children
        currentItems.add(node);
        // Set current node as parent
        if (!isRequest) {
          currentItems = (node as ItemGroup<Item>).items;
        }
      });
    });

    // Write collection to JSON file
    const outputFilename = `${collectionName}.postman_collection.json`;
    writeFileSync(outputFilename, JSON.stringify(collection, null, 2));

    return path.resolve(outputFilename);
  }
}

export const postmanUtils = new PostmanUtils();
