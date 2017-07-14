
declare module "lodash.debounce" {
  namespace debounce {}
  function debounce(callback: Function, timeInMs: number): (() => void)

  export = debounce;
}
