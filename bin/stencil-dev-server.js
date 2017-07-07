#! /usr/bin/env node
'use strict';

process.title = 'stencil-dev-server';
process.on('unhandledRejection', function(r) { console.error(r) });
process.env.TINY_STATIC_LR_BIN = __filename;

const cmdArgs = process.argv;
const npmRunArgs = process.env.npm_config_argv;
if (npmRunArgs) {
  cmdArgs = cmdArgs.concat(JSON.parse(npmRunArgs).original);
}

const server = require('../dist');

server.run(process.argv);
