'use strict';

import * as request from 'supertest';
import * as path from 'path';
import { run as devServer } from '..';

describe('GET Collection', async function () {
  let cmdArgs: string[];
  let server: any;

  beforeAll(async function () {
    cmdArgs = [
      '--config', path.join(__dirname, './empty-html5/stencil.config.js'),
      '--no-open',
    ];
    server = await devServer(cmdArgs);
  });

  describe('Scenarios for an empty directory with html5mode false', function () {
    it('should return 200 and directory contents', async function () {
      const response = await request(server).get('/');
      expect(response.status).toBe(200);
      expect(response.text).toContain('<a href="/">~</a>');
    });

    it('should return 404 for files that do not exist', async function () {
      const response = await request(server).get('/red.jpg');
      expect(response.status).toBe(404);
    });

    it('should return 404 for html files that do not exist', async function () {
      const response = await request(server).get('/red.html');
      expect(response.status).toBe(404);
    });

    it('should return 404 for folders that do not exist', async function () {
      const response = await request(server).get('/red');
      expect(response.status).toBe(404);
    });
  });
});
