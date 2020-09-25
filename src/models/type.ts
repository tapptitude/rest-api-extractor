export interface ObjectParameters {
  [key: string]: FieldType | null;
}

export interface FieldType {
  type: string;
  items?: FieldType | null;
  properties?: { [key: string]: FieldType };
  value?: any;
  isOptional?: boolean
}
