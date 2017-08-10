import * as path from 'path';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as url from 'url';
import * as tinylr from 'tiny-lr';
import * as ecstatic from 'ecstatic';
import * as opn from 'opn';
import { watch } from 'chokidar';
import * as debounce from 'lodash.debounce';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { findClosestOpenPort, parseOptions, parseConfigFile,
  getRequestedPath, getFileFromPath, fsStatPr } from './utils';
import { serveHtml, serveDirContents, sendError, sendFile } from './middlewares';

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
  }
}

export async function run(argv: string[]) {
  const cliDefaultedOptions = parseOptions(optionInfo, argv);
  cliDefaultedOptions.additionalJsScripts = cliDefaultedOptions.additionalJsScripts
    .split(',')
    .filter((name: string) => !!name);
  const isVerbose = cliDefaultedOptions.verbose;

  const configOptions = await parseConfigFile(process.cwd(), cliDefaultedOptions.config);
  const options = Object.keys(cliDefaultedOptions).reduce((options, optionName) => {
    const newValue = configOptions[optionName] || cliDefaultedOptions[optionName];
    options[optionName] = newValue;
    return options;
  }, <{ [key: string]: any }>{});

  const [ foundHttpPort, foundLiveReloadPort ] = await Promise.all([
    findClosestOpenPort(options.address, options.httpPort),
    findClosestOpenPort(options.address, options.liveReloadPort),
  ]);
  const wwwRoot = path.resolve(options.root);
  const browserUrl = getAddressForBrowser(options.address);

  const [ lrScriptLocation, emitLiveReloadUpdate ] = createLiveReload(foundLiveReloadPort, options.address, wwwRoot);
  const jsScriptLocations: string[] = options.additionalJsScripts
    .map((filePath: string) => filePath.trim())
    .concat(lrScriptLocation);

  const fileWatcher = createFileWatcher(wwwRoot, options.watchGlob, emitLiveReloadUpdate, isVerbose);
  const requestHandler = createHttpRequestHandler(wwwRoot, jsScriptLocations, options.html5mode);

  const httpServer = createServer(requestHandler).listen(foundHttpPort);

  log(isVerbose, `listening on ${browserUrl}:${foundHttpPort}`);
  log(isVerbose, `serving: ${wwwRoot}`);
  log(isVerbose, `watching: ${wwwRoot} ${options.watchGlob}`)

  opn(`http://${browserUrl}:${foundHttpPort}`);

  process.once('SIGINT', () => {
    httpServer.close();
    fileWatcher.close();
    process.exit(0);
  });
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

  const staticFileMiddleware = ecstatic({ root: wwwDir });
  const devServerFileMiddleware = ecstatic({ root: path.resolve(__dirname, '..', 'assets') });
  const sendHtml = serveHtml(wwwDir, Object.keys(jsScriptsMap));
  const sendDirectoryContents = serveDirContents(wwwDir);

  return async function(req: IncomingMessage, res: ServerResponse) {
    const reqPath = getRequestedPath(req.url || '');
    const filePath = getFileFromPath(wwwDir, req.url || '');
    let pathStat: fs.Stats;

    const serveIndexFile = async () => {
      const indexFilePath = path.join(wwwDir, 'index.html');
      let indexFileStat: fs.Stats | undefined;
      try {
        indexFileStat = await fsStatPr(indexFilePath);
      } catch (e) {
        indexFileStat = undefined;
      }
      if (indexFileStat && indexFileStat.isFile()) {
        return await sendHtml(indexFilePath, req, res);
      }
    }

    if (jsScriptsMap[(req.url || '')]) {
      return sendFile('application/javascript', jsScriptsMap[(req.url || '')], req, res);
    }

    // If the request is to a static file then just send it on using the static file middleware
    if ((req.url || '').startsWith(RESERVED_STENCIL_PATH)) {
      return devServerFileMiddleware(req, res);
    }

    try {
      pathStat = await fsStatPr(filePath);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
        if (html5mode) {
          const indexFileResponse = await serveIndexFile();
          return indexFileResponse;
        }
        return sendError(404, res, { error: err });
      }
      if (err.code === 'EACCES') {
        return sendError(403, res, { error: err });
      }
      return sendError(500, res, { error: err });
    }

    // If this is the first request then try to serve an index.html file in the root dir
    if (reqPath === '/') {
      const indexFileResponse = await serveIndexFile();
      return indexFileResponse;
    }

    // If the request is to a directory but does not end in slash then redirect to use a slash
    if (pathStat.isDirectory() && !reqPath.endsWith('/')) {
      res.statusCode = 302;
      res.setHeader('location', reqPath + '/');
      return res.end();
    }

    // If the request is to a directory then serve the directory contents
    if (pathStat.isDirectory()) {
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


function createFileWatcher(wwwDir: string, watchGlob: string, changeCb: Function, isVerbose: boolean) {
  const watcher = watch(watchGlob, {
    cwd: wwwDir,
    ignored: /(^|[\/\\])\../ // Ignore dot files, ie .git
  });

  function fileChanged(filePath: string) {
    log(isVerbose, `[${new Date().toTimeString().slice(0, 8)}] ${chalk.bold(filePath)} changed`);
    changeCb([filePath]);
  }

  watcher.on('change', debounce(fileChanged, 500));
  watcher.on('error', (err: Error) => {
    log(true, err.toString());
  });

  return watcher;
}


function createLiveReload(port: number, address: string, wwwDir: string): [string, (changedFile: string[]) => void] {
  const liveReloadServer = tinylr();
  liveReloadServer.listen(port, address);

  return [
    `http://${getAddressForBrowser(address)}:${port}/livereload.js?snipver=1`,
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
