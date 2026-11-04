(function () {
  let messageID = 0;
  const nextMessageID = () => messageID++;
  const ERROR_NOT_LOADED = new Error("ffmpeg is not loaded");
  const ERROR_TERMINATED = new Error("called FFmpeg.terminate()");

  const WORKER_SOURCE = `
const FFMessageType = {
  LOAD: "LOAD", EXEC: "EXEC", WRITE_FILE: "WRITE_FILE", READ_FILE: "READ_FILE",
  DELETE_FILE: "DELETE_FILE", RENAME: "RENAME", CREATE_DIR: "CREATE_DIR",
  LIST_DIR: "LIST_DIR", DELETE_DIR: "DELETE_DIR", ERROR: "ERROR",
  PROGRESS: "PROGRESS", LOG: "LOG", MOUNT: "MOUNT", UNMOUNT: "UNMOUNT"
};
const ERROR_UNKNOWN_MESSAGE_TYPE = new Error("unknown message type");
const ERROR_NOT_LOADED = new Error("ffmpeg is not loaded");
const ERROR_IMPORT_FAILURE = new Error("failed to import ffmpeg-core.js");
let ffmpeg;
const load = async ({ coreSource, wasmBinary }) => {
  const first = !ffmpeg;
  (0, eval)(coreSource);
  const factory = self.createFFmpegCore;
  if (typeof factory !== "function") throw ERROR_IMPORT_FAILURE;
  ffmpeg = await factory({ wasmBinary });
  ffmpeg.setLogger((data) => self.postMessage({ type: FFMessageType.LOG, data }));
  ffmpeg.setProgress((data) => self.postMessage({ type: FFMessageType.PROGRESS, data }));
  return first;
};
const exec = ({ args, timeout = -1 }) => {
  ffmpeg.setTimeout(timeout);
  ffmpeg.exec(...args);
  const ret = ffmpeg.ret;
  ffmpeg.reset();
  return ret;
};
const writeFile = ({ path, data }) => { ffmpeg.FS.writeFile(path, data); return true; };
const readFile = ({ path, encoding }) => ffmpeg.FS.readFile(path, { encoding });
const deleteFile = ({ path }) => { ffmpeg.FS.unlink(path); return true; };
const rename = ({ oldPath, newPath }) => { ffmpeg.FS.rename(oldPath, newPath); return true; };
const createDir = ({ path }) => { ffmpeg.FS.mkdir(path); return true; };
const listDir = ({ path }) => {
  const names = ffmpeg.FS.readdir(path);
  const nodes = [];
  for (const name of names) {
    const stat = ffmpeg.FS.stat(path + "/" + name);
    nodes.push({ name, isDir: ffmpeg.FS.isDir(stat.mode) });
  }
  return nodes;
};
const deleteDir = ({ path }) => { ffmpeg.FS.rmdir(path); return true; };
const mount = ({ fsType, options, mountPoint }) => {
  const fs = ffmpeg.FS.filesystems[fsType];
  if (!fs) return false;
  ffmpeg.FS.mount(fs, options, mountPoint);
  return true;
};
const unmount = ({ mountPoint }) => { ffmpeg.FS.unmount(mountPoint); return true; };
self.onmessage = async ({ data: { id, type, data: _data } }) => {
  const trans = [];
  let data;
  try {
    if (type !== FFMessageType.LOAD && !ffmpeg) throw ERROR_NOT_LOADED;
    switch (type) {
      case FFMessageType.LOAD: data = await load(_data); break;
      case FFMessageType.EXEC: data = exec(_data); break;
      case FFMessageType.WRITE_FILE: data = writeFile(_data); break;
      case FFMessageType.READ_FILE: data = readFile(_data); break;
      case FFMessageType.DELETE_FILE: data = deleteFile(_data); break;
      case FFMessageType.RENAME: data = rename(_data); break;
      case FFMessageType.CREATE_DIR: data = createDir(_data); break;
      case FFMessageType.LIST_DIR: data = listDir(_data); break;
      case FFMessageType.DELETE_DIR: data = deleteDir(_data); break;
      case FFMessageType.MOUNT: data = mount(_data); break;
      case FFMessageType.UNMOUNT: data = unmount(_data); break;
      default: throw ERROR_UNKNOWN_MESSAGE_TYPE;
    }
  } catch (error) {
    self.postMessage({ id, type: FFMessageType.ERROR, data: String(error) });
    return;
  }
  if (data instanceof Uint8Array) trans.push(data.buffer);
  self.postMessage({ id, type, data }, trans);
};
`;

  class FFmpeg {
    #worker = null;
    #resolves = {};
    #rejects = {};
    #logEventCallbacks = [];
    #progressEventCallbacks = [];
    loaded = false;

    #registerHandlers = () => {
      this.#worker.onmessage = ({ data: { id, type, data } }) => {
        switch (type) {
          case "LOAD":
            this.loaded = true;
            this.#resolves[id]?.(data);
            break;
          case "MOUNT":
          case "UNMOUNT":
          case "EXEC":
          case "WRITE_FILE":
          case "READ_FILE":
          case "DELETE_FILE":
          case "RENAME":
          case "CREATE_DIR":
          case "LIST_DIR":
          case "DELETE_DIR":
            this.#resolves[id]?.(data);
            break;
          case "LOG":
            this.#logEventCallbacks.forEach((fn) => fn(data));
            return;
          case "PROGRESS":
            this.#progressEventCallbacks.forEach((fn) => fn(data));
            return;
          case "ERROR":
            this.#rejects[id]?.(data);
            break;
          default:
            break;
        }
        delete this.#resolves[id];
        delete this.#rejects[id];
      };
    };

    #send = ({ type, data }, trans = [], signal) => {
      if (!this.#worker) return Promise.reject(ERROR_NOT_LOADED);
      return new Promise((resolve, reject) => {
        const id = nextMessageID();
        this.#resolves[id] = resolve;
        this.#rejects[id] = reject;
        this.#worker.postMessage({ id, type, data }, trans);
        signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        }, { once: true });
      });
    };

    on(event, callback) {
      if (event === "log") this.#logEventCallbacks.push(callback);
      else if (event === "progress") this.#progressEventCallbacks.push(callback);
    }

    load = (config = {}, { signal } = {}) => {
      if (!this.#worker) {
        const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
        this.#worker = new Worker(url);
        this.#registerHandlers();
      }
      const trans = config.wasmBinary instanceof Uint8Array ? [config.wasmBinary.buffer] : [];
      return this.#send({ type: "LOAD", data: config }, trans, signal);
    };

    exec = (args, timeout = -1, { signal } = {}) => this.#send({
      type: "EXEC",
      data: { args, timeout },
    }, undefined, signal);

    terminate = () => {
      Object.keys(this.#rejects).forEach((id) => {
        this.#rejects[id](ERROR_TERMINATED);
        delete this.#rejects[id];
        delete this.#resolves[id];
      });
      if (this.#worker) {
        this.#worker.terminate();
        this.#worker = null;
        this.loaded = false;
      }
    };

    writeFile = (path, data, { signal } = {}) => {
      const trans = data instanceof Uint8Array ? [data.buffer] : [];
      return this.#send({ type: "WRITE_FILE", data: { path, data } }, trans, signal);
    };

    readFile = (path, encoding = "binary", { signal } = {}) => this.#send({
      type: "READ_FILE",
      data: { path, encoding },
    }, undefined, signal);

    deleteFile = (path, { signal } = {}) => this.#send({
      type: "DELETE_FILE",
      data: { path },
    }, undefined, signal);

    createDir = (path, { signal } = {}) => this.#send({
      type: "CREATE_DIR",
      data: { path },
    }, undefined, signal);

    listDir = (path, { signal } = {}) => this.#send({
      type: "LIST_DIR",
      data: { path },
    }, undefined, signal);
  }

  window.FFmpeg = FFmpeg;
})();
