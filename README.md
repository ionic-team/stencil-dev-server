[![npm][npm-badge]][npm-badge-url]

# Stencil Dev Server

This is a very simple http-server with a filewatcher and livereload built in.

Just provide a directory.

```
stencil-dev-server --root public
```

There are a number of options available, but all have sane defaults.

- **--root**
  - The directory that should be watched and served
  - It defaults to the current directory that the command was executed from.
- **--address**
  - The ip address that the server should listen to.
  - Defaults to *0.0.0.0*. Point your browser to localhost.
- **--httpPort**
  - The port that the http server should use.  If the number provided is in use it will choose another.
  - Defaults to *3333*.
- **--liveReloadPort**
  - The port that the live-reload server should use. If the number provided is in use it will choose another.
  - Defaults to *35729*.
  
[npm-badge]: https://img.shields.io/npm/v/@stencil/dev-server.svg?style=flat-square
[npm-badge-url]: https://www.npmjs.com/package/@stencil/dev-server
