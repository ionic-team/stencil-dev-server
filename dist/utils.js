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
function findClosestOpenPort(host, port) {
    return __awaiter(this, void 0, void 0, function* () {
        function t(portToCheck) {
            return __awaiter(this, void 0, void 0, function* () {
                const isTaken = yield isPortTaken(host, portToCheck);
                if (!isTaken) {
                    return portToCheck;
                }
                return t(portToCheck + 1);
            });
        }
        return t(port);
    });
}
exports.findClosestOpenPort = findClosestOpenPort;
function isPortTaken(host, port) {
    return new Promise((resolve, reject) => {
        var net = require('net');
        var tester = net.createServer()
            .once('error', function (err) {
            if (err.code !== 'EADDRINUSE') {
                return resolve(true);
            }
            resolve(true);
        })
            .once('listening', function () {
            tester.once('close', function () {
                resolve(false);
            })
                .close();
        })
            .on('error', (err) => {
            reject(err);
        })
            .listen(port, host);
    });
}
exports.isPortTaken = isPortTaken;
function parseOptions(optionInfo, argv) {
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
    }, {});
}
exports.parseOptions = parseOptions;
