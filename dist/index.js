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
const tinylr = require("tiny-lr");
const ecstatic = require("ecstatic");
const opn = require("opn");
const chokidar_1 = require("chokidar");
const http_1 = require("http");
const utils_1 = require("./utils");
const middlewares_1 = require("./middlewares");
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
};
function run(argv) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = utils_1.parseOptions(optionInfo, argv);
        const [foundHttpPort, foundLiveReloadPort] = yield Promise.all([
            utils_1.findClosestOpenPort(options.address, options.httpPort),
            utils_1.findClosestOpenPort(options.address, options.liveReloadPort),
        ]);
        const wwwRoot = path.resolve(options.root);
        const [lrScriptLocation, emitLiveReloadUpdate] = createLiveReload(foundLiveReloadPort, options.address, wwwRoot);
        createFileWatcher(wwwRoot, emitLiveReloadUpdate);
        const requestHandler = createHttpRequestHandler(wwwRoot, lrScriptLocation);
        http_1.createServer(requestHandler).listen(foundHttpPort);
        console.log(`listening on ${getAddressForBrowser(options.address)}:${foundHttpPort}`);
        console.log(`watching ${wwwRoot}`);
        opn(`http://${getAddressForBrowser(options.address)}:${foundHttpPort}`);
    });
}
exports.run = run;
function createHttpRequestHandler(wwwDir, lrScriptLocation) {
    const staticFileMiddleware = ecstatic({ root: wwwDir });
    const sendHtml = middlewares_1.serveHtml(wwwDir, lrScriptLocation);
    const sendDirectoryContents = middlewares_1.serveDirContents(wwwDir);
    let firstRequestFlag = true;
    return function (req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const reqPath = utils_1.getRequestedPath(req.url || '');
            const filePath = utils_1.getFileFromPath(wwwDir, req.url || '');
            let pathStat;
            try {
                pathStat = yield utils_1.fsStatPr(filePath);
            }
            catch (err) {
                if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
                    return middlewares_1.sendError(404, res, { error: err });
                }
                if (err.code === 'EACCES') {
                    return middlewares_1.sendError(403, res, { error: err });
                }
                return middlewares_1.sendError(500, res, { error: err });
            }
            // If this is the first request then try to serve an index.html file in the root dir
            if (firstRequestFlag && reqPath === '/') {
                firstRequestFlag = false;
                const indexFilePath = path.join(filePath, 'index.html');
                let indexFileStat;
                try {
                    indexFileStat = yield utils_1.fsStatPr(indexFilePath);
                }
                catch (e) {
                    indexFileStat = undefined;
                }
                if (indexFileStat && indexFileStat.isFile()) {
                    return yield sendHtml(indexFilePath, req, res);
                }
            }
            // If the request is to a directory but does not end in slash then redirect to use a slash
            if (pathStat.isDirectory() && !reqPath.endsWith('/')) {
                res.statusCode = 302;
                res.setHeader('location', reqPath + '/');
                return res.end();
            }
            // If the request is to a directory then serve the directory contents
            if (pathStat.isDirectory()) {
                return yield sendDirectoryContents(filePath, req, res);
            }
            // If the request is to a file and it is an html file then use sendHtml to parse and send on
            if (pathStat.isFile() && filePath.endsWith('.html')) {
                return yield sendHtml(filePath, req, res);
            }
            // If the request is to a static file then just send it on using the static file middleware
            if (pathStat.isFile()) {
                return staticFileMiddleware(req, res);
            }
            // Not sure what you are requesting but lets just send an error
            return middlewares_1.sendError(415, res, { error: 'Resource requested cannot be served.' });
        });
    };
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
        `${getAddressForBrowser(address)}:${port}/livereload.js?snipver=1`,
        (changedFiles) => {
            liveReloadServer.changed({
                body: {
                    files: changedFiles.map(changedFile => ('/' + path.relative(wwwDir, changedFile)))
                }
            });
        }
    ];
}
function getAddressForBrowser(ipAddress) {
    return (ipAddress === '0.0.0.0') ? 'localhost' : ipAddress;
}
