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
