declare global {
  interface Array<T> {
    removeNulls(): Array<T>;
  }
}

if (!Array.prototype.removeNulls) {
  Array.prototype.removeNulls = function (this: any[]) {
    return this.filter((item) => item !== null);
  };
}

export {};
