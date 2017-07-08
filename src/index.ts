import * as path from 'path';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as tinylr from 'tiny-lr';
import * as ecstatic from 'ecstatic';
import { watch } from 'chokidar';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { findClosestOpenPort, parseOptions, getRequestedPath, getFileFromPath, fsStatPr } from './utils';
import { serveHtml, serveDirContents, sendError } from './middlewares';

const optionInfo = {
  root: {
    default: process.cwd(),
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
  }
}

export async function run(argv: string[]) {
  const options = parseOptions(optionInfo, argv);

  const [ foundHttpPort, foundLiveReloadPort ] = await Promise.all([
    findClosestOpenPort(options.address, options.httpPort),
    findClosestOpenPort(options.address, options.liveReloadPort),
  ]);
  const wwwRoot = path.resolve(options.root);

  const [ lrScriptLocation, emitLiveReloadUpdate ] = createLiveReload(foundLiveReloadPort, options.address, wwwRoot);

  createFileWatcher(wwwRoot, emitLiveReloadUpdate);
  const requestHandler = createHttpRequestHandler(wwwRoot, lrScriptLocation);

  createServer(requestHandler).listen(foundHttpPort);

  console.log(`listening on ${options.address}:${foundHttpPort}`);
  console.log(`watching ${wwwRoot}`);
}

function createHttpRequestHandler(wwwDir: string, lrScriptLocation: string) {
  const staticFileMiddleware = ecstatic({ root: wwwDir });
  const sendHtml = serveHtml(wwwDir, lrScriptLocation);
  const sendDirectoryContents = serveDirContents(wwwDir);

  return async function(req: IncomingMessage, res: ServerResponse) {
    const reqPath = getRequestedPath(req.url || '');
    const filePath = getFileFromPath(wwwDir, req.url || '');
    let pathStat: fs.Stats;

    try {
      pathStat = await fsStatPr(filePath);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
        return sendError(404, res, { error: err });
      }
      if (err.code === 'EACCES') {
        return sendError(403, res, { error: err });
      }
      return sendError(500, res, { error: err });
    }

    // serveIndexMiddleware(req, res);
    if (pathStat.isDirectory() && !reqPath.endsWith('/')) {
      res.statusCode = 302;
      res.setHeader('location', reqPath + '/');
      return res.end();
    }
    if (pathStat.isDirectory()) {
      return await sendDirectoryContents(filePath, req, res);
    }
    if (pathStat.isFile() && filePath.endsWith('.html')) {
      return await sendHtml(filePath, req, res);
    }
    if (pathStat.isFile()) {
      return staticFileMiddleware(req, res);
    }
    return sendError(415, res, { error: 'Resource requested cannot be served.' });
  }
}


function createFileWatcher(wwwDir: string, changeCb: Function) {
  const watcher = watch(`${wwwDir}`, {
    cwd: wwwDir
  });

  watcher.on('change', (filePath: string) => {
    console.log(`[${new Date().toTimeString().slice(0, 8)}] ${chalk.bold(filePath)} changed`);
    changeCb([filePath]);
  });

  watcher.on('error', (err: Error) => {
    console.error(err.toString());
  });
}


function createLiveReload(port: number, address: string, wwwDir: string): [string, (changedFile: string[]) => void] {
  const liveReloadServer = tinylr();
  liveReloadServer.listen(port, address);

  return [
    `${address}:${port}/livereload.js?snipver=1`,
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
