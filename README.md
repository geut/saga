# @geut/saga

> A helper module to share operations between peers built on top of
> hyperdb.

---
![npm version badge](https://badge.fury.io/js/%40geut%2Fsaga.svg)

## Install

`npm install @geut/saga`

## Usage

First, instantiate saga:

`const saga = Saga(ram, publicKey, username);`

Then, we will need a swarm of peers:

```javascript
const sw = swarm({
  id: username,
  stream: () => {
    return saga.replicate();
  }
});

sw.join(signalhub(discoveryKey, signalUrls), webrtcOpts);

sw.on('connection', async peer => {
  try {
    await saga.connect(peer);
  } catch (err) {
    console.log(err);
  }
});
```
_Hint:_ You can use [`@geut/discovery-swarm-webrtc`](https://github.com/geut/discovery-swarm-webrtc).

_Hint2:_ You will need a signal server, like [signalhubws](https://github.com/soyuka/signalhubws).

After that, you are ready to use `saga`. This include, sending and receiving operations that you can apply on each peer.

## API

### initialize

> Returns a `promise`.

Used to trigger hyperdb creation and setup the watch for operations.

### connect

> `Peer` | Required. The peer must have a `remoteUserData` property.

This will **authorize** the peer to be a writer. Emits a `join` event
along with peer data. Finally, if the peer leaves, it will also emit
a `leave` event, indicating the peer.

### replicate

It will replicate the stream. Uses hyperdb replicates method under the
hood with some fixed values:

```javascript
{
  live: true,
  userData: JSON.stringify({
    key: this.db.local.key,
    username: this.username,
    timestamp: this.timestamp
  })
}
```

### writeOperation

> `Object` | Optional

Use this method to send a new operation to every peer. It will also add
the username of the sender and a timestamp.

## Events

`saga` inherits from node.js `EventEmitter`. It will emit the following
events:

### join

> `peerData: Object`

After authorizing a new peer, saga will emit a join event with some peer
data. This is triggered by the `connect` method (see above).

### leave

> `peerData: Object`

After a peer leaves, the leave event will be emitted with some peer data.

### operation

> `Object`

The operation event will be emitted after reading feed history changes
(see hyperdb) caused by new operations arrival. You can listen to this
event to retrieve the latest operations that you can apply to regenerate
the distributed state between peers. The event will contain an object with
the `username` of the sender, a `timestamp` and the `operation`.

## Motivation

The idea came up after playing with [olaf](https://github.com/geut/olaf),
a P2P Dat powered chat application. That is when `saga` first appears.
Later we were playing with the idea of CRDT based editor, also Dat
powered. I wanted to re-use some parts and saga was my first option.
I only need to make some subtle changes, like mostly renaming messages to
operations in order to be more generic.

When creating P2P apps, the absence of a centralized server, empowers
peers (former _clients_). Since now they can share data between each
other, it is useful to have a way to re-create locally changes that have
happened in another peer, this is were you can use `saga`. Also keep in
mind that libraries like
[Automerge](https://github.com/automerge/automerge) are a great match!


---
Brought to you by **GEUT LABS ʘ**
