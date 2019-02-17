const EventEmitter = require('events');
const { Writable } = require('stream');
const hyperdb = require('hyperdb');
const pump = require('pump');
const hyperid = require('hyperid');
const debug = require('debug');

const log = debug('geut:saga');

const uuid = hyperid();

class ForEachChunk extends Writable {
  constructor(opts, cb) {
    if (!cb) {
      cb = opts;
      opts = {};
    }
    super(opts);

    this.cb = cb;
  }

  _write(chunk, enc, next) {
    this.cb(chunk, enc, next);
  }
}

const forEachChunk = (...args) => new ForEachChunk(...args);

class Saga extends EventEmitter {
  constructor(storage, key, username) {
    super();

    this.operations = new Map();
    this.newestOperations = new Map();
    this.users = new Map();
    this.username = username;
    this.timestamp = Date.now();

    this.db = hyperdb(storage, key, { valueEncoding: 'json' });
  }

  async initialize() {
    await this._ready();
    log('Initializing saga')
    this._updateHistory(this._watchForOperations.bind(this));
  }

  writeOperation(operation) {
    const key = `operations/${uuid()}`;
    const data = {
      key,
      operation,
      username: this.username,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      this.db.put(key, data, err => {
        if (err) {
          reject(err);
        } else {
          resolve(key);
        }
      });
    });
  }

  replicate() {
    return this.db.replicate({
      live: true,
      userData: JSON.stringify({
        key: this.db.local.key,
        username: this.username,
        timestamp: this.timestamp
      })
    });
  }

  async connect(peer) {
    if (!peer.remoteUserData) {
      throw new Error('peer does not have userData');
    }

    const data = JSON.parse(peer.remoteUserData);
    const key = Buffer.from(data.key);
    const username = data.username;

    await this._authorize(key);

    if (!this.users.has(username)) {
      this.users.set(username, new Date());
      this.emit('join', data);
      log('A new peer joins')
      peer.on('close', () => {
        if (!this.users.has(username)) return;
        this.users.delete(username);
        this.emit('leave', data);
        log('A peer leaves')
      });
    }
  }

  _authorize(key) {
    return new Promise((resolve, reject) => {
      this.db.authorized(key, (err, auth) => {
        if (err) return reject(err);

        if (auth) {
          return resolve();
        }

        this.db.authorize(key, err => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  _updateHistory(onFinish) {
    const h = this.db.createHistoryStream({ reverse: true });

    const ws = forEachChunk({ objectMode: true }, (data, enc, next) => {
      const { key } = data;

      if (/operations/.test(key)) {
        log(`Check if operation ${key} has been applied`);
        if (this.operations.has(key)) {
          // TODO(dk): check this condition, if we destroy the stream nothing works. In the other hand
          // it would be cool to not process everything again and again. That was the purpose of maintaining
          // a newestOperations array.
          // h.destroy()
          // return
        } else {
          log(`Adding new operation key ${key}`);
          this.newestOperations.set(data.key, data.value);
        }
      }

      next();
    });

    pump(h, ws, err => {
      // work with latest operations in the right order
      const values = [...this.newestOperations.values()];
      const keys = [...this.newestOperations.keys()];
      values.reverse().forEach((val, idx) => {
        log('Applying new operations');
        const key = keys[idx];
        this.emit('operation', { ...val }, key);
        log('A new operation has been sent')
        // update applied operations
        this.operations.set(key, val);
      });

      // reset newestOperations
      this.newestOperations = new Map();
      if (onFinish) onFinish(err);
    });
  }

  _watchForOperations() {
    this.db.watch('operations', () => {
      this._updateHistory();
    });
  }

  _ready() {
    return new Promise(resolve => this.db.ready(resolve));
  }
}

// export default (...args) => new Saga(...args);
module.exports = (...args) => new Saga(...args);
