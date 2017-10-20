declare module "tiny-lr" {
  namespace tinyLr {
    export interface server {
      on: Function;
      listen: Function;
      close: Function;
      changed: Function;
    }
  }
  function tinyLr(): tinyLr.server;

  export = tinyLr;
}
