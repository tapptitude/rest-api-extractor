import { Endpoint } from '../models/endpoint';
import { postmanUtils } from '../utils/postman-utils';
import chalk from 'chalk';

export class Commands {
  public static printEndpoints(endpoints: Endpoint[]) {
    const paths = endpoints.map((item) => {
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
    console.log(paths);
  }

  public static generatePostmanCollection(collectionName: string, endpoints: Endpoint[]) {
    console.log(`Generating postman collection`);
    const generatedFilePath = postmanUtils.createCollection({ collectionName, endpoints });
    console.log(`Wrote postman collection to ${chalk.yellow.bold(generatedFilePath)}`);
  }
}
