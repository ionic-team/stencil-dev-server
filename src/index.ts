import * as path from 'path';
import * as chalk from 'chalk';
import * as url from 'url';
import * as fs from 'fs';
import * as minimist from 'minimist';
import * as tinylr from 'tiny-lr';
import * as ecstatic from 'ecstatic';
import { watch } from 'chokidar';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { findClosestOpenPort, parseOptions } from './utils';
import { InputOptions } from './definitions';

const watchPatterns = '**/*';
const optionInfo = {
  root: {
    default: __dirname,
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
  createHttpServer(foundHttpPort, options.address, wwwRoot, lrScriptLocation);

  console.log(`listening on ${options.address}:${foundHttpPort}`);
  console.log(`watching ${wwwRoot}`);
}

async function createHttpServer(port: number, address: string, wwwDir: string, lrScriptLocation: string) {
  function handler(req: IncomingMessage, res: ServerResponse) {
    const urlSegments = url.parse(req.url || '/');
    if (req.url === '/' || (urlSegments.pathname && urlSegments.pathname.endsWith('.html'))) {
      return serveHtml(req, res);
    }
    return ecstatic({
      root: wwwDir
    })(req, res);
  }

  function serveHtml(req: IncomingMessage, res: ServerResponse)  {
    const urlSegments = url.parse(req.url || '');
    const filePath = (urlSegments.pathname !== '/') ? urlSegments.pathname : '/index.html';

    const indexFileName = path.join(wwwDir, filePath || '');

    fs.readFile(indexFileName, (err, indexHtml) => {
      const htmlString: string = indexHtml.toString().replace('</body>',
        `<script type="text/javascript" src="//${lrScriptLocation}" charset="utf-8"></script>
        </body>`);

      res.setHeader('Content-Type', 'text/html');
      res.end(htmlString);
    });
  }

  createServer(handler).listen(port);
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
