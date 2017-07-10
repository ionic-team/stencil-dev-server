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
const url = require("url");
const utils_1 = require("./utils");
function serveHtml(wwwDir, lrScriptLocation) {
    return function (filePath, req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const indexHtml = yield utils_1.fsReadFilePr(filePath);
            const htmlString = indexHtml.toString()
                .replace(`</body>`, `<script type="text/javascript" src="//${lrScriptLocation}" charset="utf-8"></script>
        </body>`);
            res.setHeader('Content-Type', 'text/html');
            res.end(htmlString);
        });
    };
}
exports.serveHtml = serveHtml;
function serveDirContents(wwwDir) {
    return function (dirPath, req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            let files;
            const dirUrl = req.url;
            if (!dirUrl) {
                return sendError(500, res, { err: 'Somthing is not right' });
            }
            try {
                files = yield utils_1.fsReadDirPr(dirPath);
            }
            catch (err) {
                return sendError(500, res, { err: err });
            }
            const templateSrc = yield utils_1.fsReadFilePr(path.join(__dirname, '..', 'assets', 'index.html'));
            if (!templateSrc) {
                throw new Error('wait, where is my template src.');
            }
            files = files
                .filter((fileName) => '.' !== fileName[0]) // remove hidden files
                .sort();
            const fileStats = yield Promise.all(files.map((fileName) => utils_1.fsStatPr(path.join(dirPath, fileName))));
            if (dirUrl !== '/') {
                const dirStat = yield utils_1.fsStatPr(dirPath);
                files.unshift('..');
                fileStats.unshift(dirStat);
            }
            const fileHtml = files
                .map((fileName, index) => {
                const isDirectory = fileStats[index].isDirectory();
                return (`<span class="denote">${isDirectory ? 'd' : '-'}</span> <a class="${isDirectory ? 'directory' : 'file'}" href="${url.resolve(dirUrl, fileName)}">${fileName}</a>`);
            })
                .join('<br/>\n');
            const templateHtml = templateSrc.toString()
                .replace('{style}', `
      html {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
        color: #16161d;
      }
      body {
        margin: 50px auto;
        width: 80%;
      }
      span.denote {
        font-weight: 100;
        display: inline-block;
        width: 8px;
      }
      h1 > a, h1 > a:visited {
        text-decoration: none;
        color: #5850ff;
      }
      a, a:visited {
        color: #16161d;
        display: inline-block;
        margin: 2px 0 2px 6px;
      }
      `)
                .replace('{files}', fileHtml)
                .replace('{linked-path}', dirUrl.replace(/\//g, ' / '));
            res.setHeader('Content-Type', 'text/html');
            res.end(templateHtml);
        });
    };
}
exports.serveDirContents = serveDirContents;
function sendError(httpStatus, res, content = {}) {
    res.writeHead(httpStatus, { "Content-Type": "text/plain" });
    res.write(JSON.stringify(content, null, 2));
    res.end();
}
exports.sendError = sendError;
