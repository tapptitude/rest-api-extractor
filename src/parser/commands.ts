import { Endpoint } from '../models/endpoint';
import { postmanUtils } from '../utils/postman-utils';
import chalk from 'chalk';
import { TextUtils } from '../utils/text-utils';
import { decoratorUtils } from '../utils/decorator-utils';

export class Commands {
  public static printEndpoints(endpoints: Endpoint[]) {
    endpoints.forEach((endpoint) => {
      console.log(chalk.cyan('➜  ') + chalk.bold.cyan(`[${endpoint.type?.toUpperCase()}] ${endpoint.path}`));
      if (endpoint.type !== 'get') {
        console.log('    ' + chalk.bold.yellow('body: '));
        Object.entries(endpoint.body).forEach(([k, v]) => TextUtils.printFieldType(k, v, ' '.repeat(8)));
      }
      console.log('    ' + chalk.bold.yellow('query: ') + Object.keys(endpoint.query).join(', '));
      console.log('    ' + chalk.bold.yellow('headers: ') + Object.keys(endpoint.headers).join(', '));
      console.log('    ' + chalk.bold.yellow('response: '));
      Object.entries(endpoint.response).forEach(([k, v]) => TextUtils.printFieldType(k, v, ' '.repeat(8)));
    });
  }

  public static generatePostmanCollection(collectionName: string, endpoints: Endpoint[]) {
    console.log(`Generating postman collection`);
    const generatedFilePath = postmanUtils.createCollection({ collectionName, endpoints });
    console.log(`Wrote postman collection to ${chalk.yellow.bold(generatedFilePath)}`);
  }

  public static generateValidateDecorator(filePath: string, endpoints: Endpoint[]) {
    console.log(`Generating route types for validation decorator`);
    const generatedFilePath = decoratorUtils.generateRouteTypes({ filePath, endpoints });
    console.log(`Wrote route types for validation decorator to ${chalk.yellow.bold(generatedFilePath)}`);
  }
}
