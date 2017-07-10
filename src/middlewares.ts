import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { fsReadFilePr, fsReadDirPr, fsStatPr } from './utils';

export function serveHtml(wwwDir: string, lrScriptLocation: string) {
  return async function(filePath: string, req: IncomingMessage, res: ServerResponse) {
    const indexHtml = await fsReadFilePr(filePath);
    const htmlString: string = indexHtml.toString()
      .replace(
        `</body>`,
        `<script type="text/javascript" src="//${lrScriptLocation}" charset="utf-8"></script>
        </body>`
      );

    res.setHeader('Content-Type', 'text/html');
    res.end(htmlString);
  };
}

export function serveDirContents(wwwDir: string) {
  return async function(dirPath: string, req: IncomingMessage, res: ServerResponse) {
    let files: string[];
    const dirUrl = req.url;
    if (!dirUrl) {
      return sendError(500, res, { err: 'Somthing is not right' });
    }
    try {
      files = await fsReadDirPr(dirPath);
    } catch(err) {
      return sendError(500, res, { err: err});
    }

    const templateSrc = await fsReadFilePr(path.join(__dirname, '..', 'assets', 'index.html'));
    if (!templateSrc) {
      throw new Error('wait, where is my template src.');
    }
    files = files
      .filter((fileName) => '.' !== fileName[0]) // remove hidden files
      .sort();

    const fileStats: fs.Stats[] = await Promise.all(files.map((fileName) =>
      fsStatPr(path.join(dirPath, fileName))
    ));

    if (dirUrl !== '/') {
      const dirStat = await fsStatPr(dirPath);
      files.unshift('..');
      fileStats.unshift(dirStat);
    }

    const fileHtml = files
      .map((fileName, index) => {
        const isDirectory = fileStats[index].isDirectory();
        return (
          `${isDirectory ? 'd' : '-'} <a class="${
             isDirectory ? 'directory' : 'file'
            }" href="${url.resolve(dirUrl, fileName)}">${fileName}</a>`
        );
      })
      .join('<br/>\n');

    const templateHtml = templateSrc.toString()
      .replace('{style}', `
      html {
       font-family: Courier New;
      }
      body {
        margin: 50px auto;
        width: 80%;
      }
      a, a:visited {
        color: #000;
        display: inline-block;
        margin: 2px 0;
      }
      `)
      .replace('{files}', fileHtml)
      .replace('{linked-path}', dirUrl.replace(/\//g,' / '));


    res.setHeader('Content-Type', 'text/html');
    res.end(templateHtml);
  }
}

export function sendError(httpStatus: number, res: ServerResponse, content: { [key: string]: any } = {}) {
  res.writeHead(httpStatus, {"Content-Type": "text/plain"});
  res.write(JSON.stringify(content, null, 2));
  res.end();
}
