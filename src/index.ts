import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import * as tinylr from 'tiny-lr';
import * as ecstatic from 'ecstatic';
import * as opn from 'opn';
import * as http  from 'http';
import * as https from 'https';
import { watch, FSWatcher } from 'chokidar';
import { findClosestOpenPort, parseOptions, parseConfigFile,
  getRequestedPath, getFileFromPath, fsStatPr ,getSSL} from './utils';
import { serveHtml, serveDirContents, sendError, sendFile } from './middlewares';
import { newSilentPublisher } from '@ionic/discover';



const RESERVED_STENCIL_PATH = '/__stencil-dev-server__';

const optionInfo = {
  root: {
    default: 'www',
    type: String
  },
  verbose: {
    default: false,
    type: Boolean
  },
  html5mode: {
    default: true,
    type: Boolean
  },
  watchGlob: {
    default: '**/*',
    type: String
  },
  address: {
    default: '0.0.0.0',
    type: String
  },
  httpPort: {
    default: 3333,
    type: Number
  },
  liveReloadPort: {
    default: 35729,
    type: Number
  },
  additionalJsScripts: {
    default: '',
    type: String
  },
  config: {
    default: './stencil.config.js',
    type: String
  },
  ssl: {
    default: false,
    type: Boolean
  }
}

export interface StencilDevServer {
  httpServer: http.Server | https.Server,
  fileWatcher: FSWatcher,
  tinyLrServer: tinylr.server,
  close: () => Promise<void>
}

export async function run(argv: string[]) {
  const cliDefaultedOptions = parseOptions(optionInfo, argv);
  cliDefaultedOptions.additionalJsScripts = cliDefaultedOptions.additionalJsScripts
    .split(',')
    .filter((name: string) => !!name);
  const isVerbose = cliDefaultedOptions.verbose;
  const configOptions = await parseConfigFile(process.cwd(), cliDefaultedOptions.config);
  const options = Object.keys(cliDefaultedOptions).reduce((options, optionName) => {
    const newValue =  (configOptions[optionName] == null) ?
      cliDefaultedOptions[optionName] :
      configOptions[optionName];
    options[optionName] = newValue;
    return options;
  }, <{ [key: string]: any }>{});

  const [ foundHttpPort, foundLiveReloadPort ] = await Promise.all([
    findClosestOpenPort(options.address, options.httpPort),
    findClosestOpenPort(options.address, options.liveReloadPort),
  ]);

  const protocol:string = options.ssl ? 'https' : 'http';
  log(isVerbose, `Will serve requests using : ${protocol}`);

  const wwwRoot = path.resolve(options.root);
  const browserUrl = getAddressForBrowser(options.address);
  const [ tinyLrServer, lrScriptLocation, emitLiveReloadUpdate ] = await createLiveReload(foundLiveReloadPort, options.address, wwwRoot , options.ssl);

  const jsScriptLocations: string[] = options.additionalJsScripts
    .map((filePath: string) => filePath.trim())
    .concat(lrScriptLocation);

  const fileWatcher = createFileWatcher(wwwRoot, options.watchGlob, emitLiveReloadUpdate, isVerbose);
  log(isVerbose, `watching: ${wwwRoot} ${options.watchGlob}`);

  const requestHandler = createHttpRequestHandler(wwwRoot, jsScriptLocations, options.html5mode);

  const httpServer  = options.ssl ? https.createServer( await getSSL() ,requestHandler).listen(foundHttpPort)
                                  : http.createServer(requestHandler).listen(foundHttpPort);

  log(isVerbose, `listening on ${protocol}://${browserUrl}:${foundHttpPort}`);
  log(isVerbose, `serving: ${wwwRoot}`);

  if (argv.indexOf('--no-open') === -1) {
    opn(`${protocol}://${browserUrl}:${foundHttpPort}`);
  }

  if (argv.indexOf('--broadcast') >= 0) {
    log(isVerbose, 'publishing broadcast');
    newSilentPublisher('devapp', 'stencil-dev', foundHttpPort);
  }

  async function close() {
    fileWatcher.close();
    tinyLrServer.close();
    await new Promise((resolve, reject) => {
      httpServer.close((err: Error) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  process.once('SIGINT', async () => {
    await close();
    process.exit(0);
  });

  return {
    httpServer,
    fileWatcher,
    tinyLrServer,
    close
  } as StencilDevServer;
}

function createHttpRequestHandler(wwwDir: string, jsScriptsList: string[], html5mode: boolean) {
  const jsScriptsMap = jsScriptsList.reduce((map, fileUrl: string): { [key: string ]: string } => {
    const urlParts = url.parse(fileUrl);
    if (urlParts.host) {
      map[fileUrl] = fileUrl;
    } else {
      const baseFileName = path.basename(fileUrl);
      map[path.join(RESERVED_STENCIL_PATH, 'js_includes', baseFileName)] = path.resolve(process.cwd(), fileUrl);
    }
    return map;
  }, <{ [key: string ]: string }>{});

  const staticFileMiddleware = ecstatic({ root: wwwDir, cache: 0 });
  const devServerFileMiddleware = ecstatic({ root: path.resolve(__dirname, '..', 'assets') });
  const sendHtml = serveHtml(wwwDir, Object.keys(jsScriptsMap));
  const sendDirectoryContents = serveDirContents(wwwDir);

  return async function(req: http.IncomingMessage | https.IncomingMessage , res: http.ServerResponse | https.ServerResponse) {
    const reqPath = getRequestedPath(req.url || '');
    const filePath = getFileFromPath(wwwDir, req.url || '');
    let pathStat: fs.Stats;

    const serveIndexFile = async (directory: string) => {
      const indexFilePath = path.join(directory, 'index.html');
      let indexFileStat: fs.Stats | undefined;
      try {
        indexFileStat = await fsStatPr(indexFilePath);
      } catch (err) {}

      if (indexFileStat && indexFileStat.isFile()) {
        return sendHtml(indexFilePath, req, res);
      }
    }

    // If the file is a member of the scripts we autoload then serve it
    if (jsScriptsMap[(req.url || '')]) {
      return sendFile('application/javascript', jsScriptsMap[(req.url || '')], req, res);
    }

    // If the request is to a static file that is part of this package
    // then just send it on using the static file middleware
    if ((req.url || '').startsWith(RESERVED_STENCIL_PATH)) {
      return devServerFileMiddleware(req, res);
    }

    try {
      pathStat = await fsStatPr(filePath);
    } catch (err) {

      // File or path does not exist
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
        if (html5mode && (['.html', ''].indexOf(path.extname(filePath)) !== -1)) {
          await serveIndexFile(wwwDir);
          if (res.finished) {
            return;
          }
        }

        // The wwwDir index.html file does not exist.
        return sendError(404, res, { error: err });
      }

      // No access to the file.
      if (err.code === 'EACCES') {
        return sendError(403, res, { error: err });
      }

      // Not sure what happened.
      return sendError(500, res, { error: err });
    }

    // If this is the first request then try to serve an index.html file in the root dir
    if (reqPath === '/') {
      await serveIndexFile(wwwDir);
      if (res.finished) {
        return;
      }
    }


    // If the request is to a directory then serve the directory contents
    if (pathStat.isDirectory()) {
      await serveIndexFile(filePath);
      if (res.finished) {
        return;
      }

      // If the request is to a directory but does not end in slash then redirect to use a slash
      if (!reqPath.endsWith('/')) {
        res.writeHead(302, {
          'location': reqPath + '/'
        });
        return res.end();
      }

      return await sendDirectoryContents(filePath, req, res);
    }

    // If the request is to a file and it is an html file then use sendHtml to parse and send on
    if (pathStat.isFile() && filePath.endsWith('.html')) {
      return await sendHtml(filePath, req, res);
    }
    if (pathStat.isFile()) {
      return staticFileMiddleware(req, res);
    }

    // Not sure what you are requesting but lets just send an error
    return sendError(415, res, { error: 'Resource requested cannot be served.' });
  }
}

let timeoutId: NodeJS.Timer;

function createFileWatcher(wwwDir: string, watchGlob: string, changeCb: Function, isVerbose: boolean) {
  const watcher = watch(watchGlob, {
    cwd: wwwDir,
    ignored: /(^|[\/\\])\../ // Ignore dot files, ie .git
  });

  function fileChanged(filePath: string) {
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      log(isVerbose, `[${new Date().toTimeString().slice(0, 8)}] ${filePath} changed`);
      changeCb([filePath]);
    }, 50);
  }

  watcher.on('change', fileChanged);
  watcher.on('error', (err: Error) => {
    log(true, err.toString());
  });

  return watcher;
}


async function createLiveReload(port: number, address: string, wwwDir: string , ssl: boolean): Promise<[ tinylr.server, string, (changedFile: string[]) => void]> {

  const options:any = ssl ? await getSSL() : {};
  const protocol:string = ssl ? 'https' : 'http';

  const liveReloadServer = tinylr(options);
  liveReloadServer.listen(port,address);

  return [
    liveReloadServer,
    `${protocol}://${getAddressForBrowser(address)}:${port}/livereload.js?snipver=1`,
    (changedFiles: string[]) => {
      liveReloadServer.changed({
        body: {
          files: changedFiles.map(changedFile => (
            '/' + path.relative(wwwDir, changedFile)
          ))
        }
      });
    }
  ];
}

function getAddressForBrowser(ipAddress: string) {
  return (ipAddress === '0.0.0.0') ? 'localhost' : ipAddress;
}

function log(test: boolean, ...args: any[]) {
  if (test) {
    console.log(...args);
  }
}
