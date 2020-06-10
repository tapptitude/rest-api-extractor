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
}
