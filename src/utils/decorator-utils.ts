import { Endpoint } from '../models/endpoint';
import fs from 'fs';
import path from 'path';

export class DecoratorUtils {
  public generateRouteTypes({ filePath, endpoints }: { filePath: string; endpoints: Endpoint[] }) {
    const fullPath = path.resolve(filePath);
    let content = `import { ObjectParameters } from './validator-models';

export const routeTypes: { [key: string]: ObjectParameters } = {
`;
    endpoints.forEach((endpoint) => {
      if (Object.keys(endpoint.body || {}).length > 0) {
        content += `    \"${endpoint.type} ${endpoint.path}\": ${JSON.stringify(endpoint.body)},\n`;
      }
    });
    content += '}\n';
    fs.writeFileSync(fullPath, content);
    return fullPath;
  }
}

export const decoratorUtils = new DecoratorUtils();
