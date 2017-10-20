'use strict';

import * as request from 'supertest';
import * as path from 'path';
import { run as createDevServer, StencilDevServer } from '..';

describe('GET Collection', async function () {
  let cmdArgs: string[];
  let devServer: StencilDevServer;

  beforeAll(async function () {
    cmdArgs = [
      '--config', path.join(__dirname, './simple/stencil.config.js'),
      '--no-open',
    ];
    devServer = await createDevServer(cmdArgs);
  });

  afterAll(async function () {
    await devServer.close();
  });

  describe('Scenarios for html5mode true', function () {
    it('should return 200 for index', async function () {
      const response = await request(devServer.httpServer).get('/');
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toEqual('text/html');
      expect(response.header['expires']).toEqual('0');
      expect(response.header['cache-control']).toEqual(
        'no-cache, no-store, must-revalidate, max-age=0'
      );
      expect(response.text).toContain('/__stencil-dev-server__/js_includes/alert.js');
      expect(response.text).toContain('http://localhost:4444/red/blue.js');
    });

    it('should return 200 and index file for files that do not exist', async function () {
      const response = await request(devServer.httpServer).get('/red.jpg');
      expect(response.status).toBe(404);
    });

    it('should return 200 and index file for html files that do not exist', async function () {
      const response = await request(devServer.httpServer).get('/red.html');
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toEqual('text/html');
    });

    it('should return 200 and index file for folders that do not exist', async function () {
      const response = await request(devServer.httpServer).get('/red');
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toEqual('text/html');
    });
  });
});
