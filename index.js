const EventEmitter = require('events')
const encodings = require('./encodings')

// exported api
// =

class DatEphemeralExtMsg extends EventEmitter {
  constructor () {
    super()
    this.datWatchers = {}
  }

  getWatcher (dat) {
    var key = toStr(dat.key)
    return {key, watcher: this.datWatchers[key]}
  }

  watchDat (dat) {
    var {key, watcher} = this.getWatcher(dat)
    if (!watcher) {
      watcher = this.datWatchers[key] = new DatWatcher(dat, this)
      watcher.listen()
    }
  }

  unwatchDat (dat) {
    var {key, watcher} = this.getWatcher(dat)
    if (watcher) {
      watcher.unlisten()
      delete this.datWatchers[key]
    }
  }

  // does the given peer have protocol support?
  hasSupport (dat, remoteId) {
    var {watcher} = this.getWatcher(dat)
    if (watcher) {
      var peer = watcher.getPeer(remoteId)
      if (peer) {
        return remoteSupports(peer, 'ephemeral')
      }
    }
    return false
  }

  // send a message to a peer
  send (dat, remoteId, message) {
    var {watcher} = this.getWatcher(dat)
    if (watcher) {
      return watcher.send(remoteId, message)
    }
  }

  // send a message to all peers
  broadcast (dat, message) {
    var {watcher} = this.getWatcher(dat)
    if (watcher) {
      return watcher.broadcast(message)
    }
  }
}
exports.DatEphemeralExtMsg = DatEphemeralExtMsg

// internal
// =

// helper class to track individual dats
class DatWatcher {
  constructor (dat, emitter) {
    this.dat = dat
    this.emitter = emitter

    this.onPeerAdd = this.onPeerAdd.bind(this)
    this.onPeerRemove = this.onPeerRemove.bind(this)
  }

  send (remoteId, message = {}) {
    // get peer and assure support exists
    var peer = this.getPeer(remoteId)
    if (!remoteSupports(peer, 'ephemeral')) {
      return
    }

    // send
    message = serialize(message)
    getPeerFeedStream(peer).extension('ephemeral', message)
  }

  broadcast (message) {
    // serialize message
    message = serialize(message)

    // send to all peers
    var peers = this.hypercore.peers
    for (let i = 0; i < peers.length; i++) {
      this.send(peers[i], message)
    }
  }

  listen () {
    this.hypercore.on('peer-add', this.onPeerAdd)
    this.hypercore.on('peer-remove', this.onPeerRemove)
  }

  unlisten () {
    this.hypercore.removeListener('peer-add', this.onPeerAdd)
    this.hypercore.removeListener('peer-remove', this.onPeerRemove)
  }

  get hypercore () {
    // if dat is a hyperdrive, use the metadata hypercore,
    // if it’s hyperdb, use the source hypercore,
    // otherwise assume dat is a hypercore already
    if (this.dat.metadata) {
      return this.dat.metadata
    } else if (this.dat.source) {
      return this.dat.source
    } else {
      return this.dat
    }
  }

  getPeer (remoteId) {
    remoteId = toRemoteId(remoteId)
    return this.hypercore.peers.find(p => isSameId(remoteId, toRemoteId(p)))
  }

  onPeerAdd (peer) {
    getPeerFeedStream(peer).on('extension', (type, message) => {
      // handle ephemeral messages only
      if (type !== 'ephemeral') return

      try {
        // decode
        message = encodings.EphemeralMessage.decode(message)

        // emit
        this.emitter.emit('message', this.dat, peer, message)
      } catch (e) {
        this.emitter.emit('received-bad-message', e, this.dat, peer, message)
      }
    })
  }

  onPeerRemove (peer) {
    // TODO needed?
  }
}

function serialize (message) {
  if (Buffer.isBuffer(message)) {
    return message // already encoded
  }

  // massage values
  if (!message.payload) {
    message.payload = Buffer.from([])
  } else if (typeof message.payload === 'string') {
    message.payload = Buffer.from(message.payload, 'utf8')
  }
  if (typeof message.contentType !== 'string') {
    message.contentType = undefined
  }

  // serialize
  return encodings.EphemeralMessage.encode(message)
}

function getPeerFeedStream (peer) {
  if (!peer) return null
  return peer.stream
}

function getPeerProtocolStream (peer) {
  var feedStream = getPeerFeedStream(peer)
  if (!feedStream) return null
  return feedStream.stream
}

function getPeerRemoteId (peer) {
  var protocolStream = getPeerProtocolStream(peer)
  if (!protocolStream) return null
  return protocolStream.remoteId
}

function remoteSupports (peer, ext) {
  var protocolStream = getPeerProtocolStream(peer)
  if (!protocolStream) return false
  return protocolStream.remoteSupports(ext)
}

function toRemoteId (peer) {
  if (peer && typeof peer === 'object') {
    return getPeerRemoteId(peer)
  }
  return peer
}

function toStr (buf) {
  if (!buf) return buf
  if (Buffer.isBuffer(buf)) return buf.toString('hex')
  return buf
}

function isSameId (a, b) {
  if (!a || !b) return false
  if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) {
    return a.equals(b)
  }
  return toStr(a) === toStr(b)
}
