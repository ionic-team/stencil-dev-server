'use strict';

import * as request from 'supertest';
import * as path from 'path';
import { run as createDevServer, StencilDevServer } from '..';

describe('GET Collection', async function () {
  let cmdArgs: string[];
  let devServer: StencilDevServer;

  beforeAll(async function () {
    cmdArgs = [
      '--config', path.join(__dirname, './empty/stencil.config.js'),
      '--no-open',
    ];
    devServer = await createDevServer(cmdArgs);
  });

  afterAll(async function () {
    await devServer.close();
  });

  describe('Scenarios for an empty directory with html5mode false', function () {
    it('should return 200 and directory contents', async function () {
      const response = await request(devServer.httpServer).get('/');
      expect(response.status).toBe(200);
      expect(response.text).toContain('<a href="/">~</a>');
    });

    it('should return 404 for files that do not exist', async function () {
      const response = await request(devServer.httpServer).get('/red.jpg');
      expect(response.status).toBe(404);
    });

    it('should return 404 for html files that do not exist', async function () {
      const response = await request(devServer.httpServer).get('/red.html');
      expect(response.status).toBe(404);
    });

    it('should return 404 for folders that do not exist', async function () {
      const response = await request(devServer.httpServer).get('/red');
      expect(response.status).toBe(404);
    });
  });
});
