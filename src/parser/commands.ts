import { Endpoint } from '../models/endpoint';
import { postmanUtils } from '../utils/postman-utils';
import chalk from 'chalk';

export class Commands {
  public static printEndpoints(endpoints: Endpoint[]) {
    endpoints.forEach((endpoint) => {
      console.log(chalk.cyan('➜  ') + chalk.bold.cyan(endpoint.path));
      Object.keys(endpoint.body).length > 0 &&
        console.log('    ' + chalk.bold.yellow('body: ') + Object.keys(endpoint.body).join(', '));
      Object.keys(endpoint.query).length > 0 &&
        console.log('    ' + chalk.bold.yellow('query: ') + Object.keys(endpoint.query).join(', '));
      Object.keys(endpoint.headers).length > 0 &&
        console.log('    ' + chalk.bold.yellow('headers: ') + Object.keys(endpoint.headers).join(', '));
    });
  }

  public static generatePostmanCollection(collectionName: string, endpoints: Endpoint[]) {
    console.log(`Generating postman collection`);
    const generatedFilePath = postmanUtils.createCollection({ collectionName, endpoints });
    console.log(`Wrote postman collection to ${chalk.yellow.bold(generatedFilePath)}`);
  }
}
