
declare module "ecstatic" {
  import * as http from  'http';
  interface ServeOptions {
    root: string
    port?: number
    baseDir?: string
    cache?: number
    showDir?: boolean
    showDotFiles?: boolean
    autoIndex?: boolean
    humanReadable?: boolean
    headers?: { [header_name: string]: any }
    si?: boolean
    defaultExt?: string
    gzip?: boolean
    serverHeader?: boolean
    contentType?: string
    mimeTypes?: { [file_extension: string]: string }
    handleOptionsMethod?: boolean
  }
  namespace ecstatic {}
  function ecstatic(options: ServeOptions): ((request: http.IncomingMessage, response: http.ServerResponse) => void)

  export = ecstatic;
}
