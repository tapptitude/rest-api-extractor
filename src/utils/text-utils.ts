import { FieldType } from '../models/type';
import chalk from 'chalk';

export class TextUtils {
  public static httpMethodToVerb(method: string): string {
    switch (method.toLowerCase()) {
      case 'get':
        return 'get';
      case 'post':
        return 'add';
      case 'put':
      case 'patch':
        return 'update';
      case 'delete':
        return 'remove';
      default:
        return '';
    }
  }

  public static humanizeText(text: string): string {
    if (!text) return '';
    return (text as any)
      .match(/^[a-z]+|[A-Z][a-z]*/g)
      .map((str: string) => str.toLowerCase())
      .join(' ');
  }

  public static capitalizeText(text: string): string {
    return text.replace(/(?:^|\s|["'([{])+\S/g, (match) => match.toUpperCase());
  }

  public static objectToString(obj: any): string {
    return Object.entries(obj)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
  }

  public static printFieldType(key: string, typeObject: FieldType | null, padding = '', isArray = false) {
    if (!typeObject) {
      // Is null, we don't know the type
      const typeStr = `null${isArray ? '[]' : ''}`;
      console.log(`${padding}${key}: ${chalk.yellow(typeStr)}`);
    } else if (typeObject.type === 'object') {
      // Object type
      console.log(`${padding}${key}: ${chalk.yellow('{')}`);
      Object.entries(typeObject.properties!).forEach(([k, v]) => {
        TextUtils.printFieldType(k, v, `${padding}  `);
      });
      const endStr = `}${isArray ? '[]' : ''}`;
      console.log(`${padding}${chalk.yellow(endStr)}`);
    } else if (typeObject.type === 'array') {
      // Array type
      TextUtils.printFieldType(key, typeObject.items!, padding, true);
    } else {
      // Primitive type
      const typeStr = `${typeObject.type}${typeObject.value ? ' (' + typeObject.value + ')' : ''}${isArray ? '[]' : ''}`;
      console.log(`${padding}${key}: ${chalk.yellow(typeStr)}`);
    }
  }
}
