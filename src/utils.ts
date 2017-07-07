export async function findClosestOpenPort(host: string, port: number): Promise<number> {
  async function t(portToCheck: number): Promise<number> {
    const isTaken = await isPortTaken(host, portToCheck);
    if (!isTaken) {
      return portToCheck;
    }
    return t(portToCheck + 1);
  }

  return t(port);
}

export function isPortTaken(host: string, port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    var net = require('net');

    var tester = net.createServer()
    .once('error', function(err: any) {
      if (err.code !== 'EADDRINUSE') {
        return resolve(true);
      }
      resolve(true);
    })
    .once('listening', function() {
      tester.once('close', function() {
        resolve(false);
      })
      .close();
    })
    .on('error', (err: any) => {
      reject(err);
    })
    .listen(port, host);
  });
}

export function parseOptions(optionInfo: { [key: string]: any }, argv: string[]): { [key: string]: any } {
  return Object.keys(optionInfo).reduce((options, key) => {
    let foundIndex = argv.indexOf(`--${key}`);
    if (foundIndex === -1) {
      options[key] = optionInfo[key].default;
      return options;
    }
    switch (optionInfo[key].type) {
    case Boolean:
      options[key] = true;
      break;
    case Number:
      options[key] = parseInt(argv[foundIndex + 1], 10);
      break;
    default:
      options[key] = argv[foundIndex + 1];
    }
    return options;
  }, <{[key: string]: any}>{});
}
