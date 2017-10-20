import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { fsReadFilePr, fsReadDirPr, fsStatPr } from './utils';

export function serveHtml(wwwDir: string, scriptLocations: string[]) {
  return async function(filePath: string, req: IncomingMessage, res: ServerResponse) {
    const indexHtml = await fsReadFilePr(filePath);
    const appendString = scriptLocations.map(sl => `<script type="text/javascript" src="${sl}" charset="utf-8"></script>`).join('\n');
    const htmlString: string = indexHtml.toString()
      .replace(
        `</body>`,
        `${appendString}
        </body>`
      );

    res.writeHead(200, {
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Expires': '0',
      'Content-Type': 'text/html'
    });
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
          `<span class="denote">${isDirectory ? 'd' : '-'}</span> <a class="${
             isDirectory ? 'directory' : 'file'
            }" href="${url.resolve(dirUrl, fileName)}">${fileName}</a>`
        );
      })
      .join('<br/>\n');

    const templateHtml = templateSrc.toString()
      .replace('{directory}', dirPath)
      .replace('{files}', fileHtml)
      .replace('{linked-path}', dirUrl.replace(/\//g,' / '));


    res.writeHead(200, {
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Expires': '0',
      'Content-Type': 'text/html'
    });
    res.end(templateHtml);
  }
}
export async function sendFile(contentType: string, filePath: string, req: IncomingMessage, res: ServerResponse) {
  const stat = await fsStatPr(filePath);

  if (!stat.isFile()) {
    return sendError(404, res, { error: 'File not found'});
  }

  res.writeHead(200, {
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Expires': '0',
    'Content-Type': contentType,
    'Content-Length': stat.size
  });

  fs.createReadStream(filePath)
    .pipe(res);
}

export function sendError(httpStatus: number, res: ServerResponse, content: { [key: string]: any } = {}) {
  res.writeHead(httpStatus, {
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Expires': '0',
    'Content-Type': 'text/plain'
  });
  res.write(JSON.stringify(content, null, 2));
  res.end();
}
