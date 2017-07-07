"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const chalk = require("chalk");
const url = require("url");
const fs = require("fs");
const minimist = require("minimist");
const tinylr = require("tiny-lr");
const ecstatic = require("ecstatic");
const chokidar_1 = require("chokidar");
const http_1 = require("http");
const utils_1 = require("./utils");
const watchPatterns = '**/*';
const defaultOptions = {
    root: __dirname,
    address: '0.0.0.0',
    httpPort: 3333,
    liveReloadPort: 35729
};
function run(argv) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = minimist(argv.slice(2), {
            default: defaultOptions
        });
        const [foundHttpPort, foundLiveReloadPort] = yield Promise.all([
            utils_1.findClosestOpenPort(options.address, options.httpPort),
            utils_1.findClosestOpenPort(options.address, options.liveReloadPort),
        ]);
        const wwwRoot = path.resolve(options.root);
        const [lrScriptLocation, emitLiveReloadUpdate] = createLiveReload(foundLiveReloadPort, options.address, wwwRoot);
        createFileWatcher(wwwRoot, emitLiveReloadUpdate);
        createHttpServer(foundHttpPort, options.address, wwwRoot, lrScriptLocation);
        console.log(`listening on ${options.address}:${foundHttpPort}`);
        console.log(`watching ${wwwRoot}`);
    });
}
exports.run = run;
function createHttpServer(port, address, wwwDir, lrScriptLocation) {
    return __awaiter(this, void 0, void 0, function* () {
        function handler(req, res) {
            const urlSegments = url.parse(req.url || '/');
            if (req.url === '/' || (urlSegments.pathname && urlSegments.pathname.endsWith('.html'))) {
                return serveHtml(req, res);
            }
            return ecstatic({
                root: wwwDir
            })(req, res);
        }
        function serveHtml(req, res) {
            // respond with the index.html file
            const urlSegments = url.parse(req.url || '');
            const filePath = (urlSegments.pathname !== '/') ? urlSegments.pathname : '/index.html';
            const indexFileName = path.join(wwwDir, filePath || '');
            console.log(indexFileName);
            fs.readFile(indexFileName, (err, indexHtml) => {
                const htmlString = indexHtml.toString().replace('</body>', `<script type="text/javascript" src="//${lrScriptLocation}" charset="utf-8"></script>
        </body>`);
                res.setHeader('Content-Type', 'text/html');
                res.end(htmlString);
            });
        }
        http_1.createServer(handler).listen(port);
    });
}
function createFileWatcher(wwwDir, changeCb) {
    const watcher = chokidar_1.watch(`${wwwDir}`, {
        cwd: wwwDir
    });
    watcher.on('change', (filePath) => {
        console.log(`[${new Date().toTimeString().slice(0, 8)}] ${chalk.bold(filePath)} changed`);
        changeCb([filePath]);
    });
    watcher.on('error', (err) => {
        console.error(err.toString());
    });
}
function createLiveReload(port, address, wwwDir) {
    const liveReloadServer = tinylr();
    liveReloadServer.listen(port, address);
    return [
        `${address}:${port}/livereload.js?snipver=1`,
        (changedFiles) => {
            liveReloadServer.changed({
                body: {
                    files: changedFiles.map(changedFile => ('/' + path.relative(wwwDir, changedFile)))
                }
            });
        }
    ];
}
