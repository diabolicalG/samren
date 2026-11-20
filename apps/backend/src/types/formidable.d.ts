declare module "formidable" {
  import type { IncomingMessage } from "node:http";

  export interface File {
    filepath: string;
    originalFilename: string | null;
    mimetype: string | null;
  }

  export interface Fields {
    [field: string]: string | string[] | undefined;
  }

  export interface Files {
    [field: string]: File[] | undefined;
  }

  export interface Options {
    uploadDir?: string;
    maxFiles?: number;
    maxFields?: number;
    maxFieldsSize?: number;
    maxFileSize?: number;
    maxTotalFileSize?: number;
    allowEmptyFiles?: boolean;
    minFileSize?: number;
    multiples?: boolean;
    keepExtensions?: boolean;
  }

  export interface IncomingForm {
    on(event: "fileBegin", listener: (fieldName: string, file: File) => void): this;
    parse(request: IncomingMessage): Promise<[Fields, Files]>;
  }

  export default function formidable(options?: Options): IncomingForm;
}
