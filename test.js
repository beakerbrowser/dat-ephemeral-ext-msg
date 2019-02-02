var tape = require('tape')
var database = require('hyperdrive')
var ram = require('random-access-memory')
var {DatEphemeralExtMsg} = require('./')

var isHypercore = database.name === 'Feed'
var isHyperDB = database.name === 'HyperDB'
var isHyperdrive = database.name === 'Hyperdrive'

tape('exchange ephemeral messages', function (t) {
  // must use 2 instances to represent 2 different nodes
  var srcEphemeral = new DatEphemeralExtMsg()
  var cloneEphemeral = new DatEphemeralExtMsg()

  var src = database(ram)
  var clone
  var cloneFeed

  var self = this

  // Isomorphic interface to support hypercore, hyperdb, and hyperdrive.
  // The three packages have slightly different APIs that makes this necessary.
  // TODO: open issue for unifying the interfaces.
  var srcFeed = src.source || src.metadata || src
  var putFunction = isHyperdrive ? 'writeFile' : isHyperDB ? 'put' : 'append'

  firstCallback = (err) => {
    t.error(err, 'no error')
    src[putFunction].apply(src, secondArgs)
  }

  secondCallback = (err) => {
    t.error(err, 'no error')
    src[putFunction].apply(src, thirdArgs)
  }

  thirdCallback = (err) => {
    t.error(err, 'no error')
    if (isHyperdrive) {
      t.same(src.version, 3, 'version correct')
    }

    // generate clone instance
    clone = database(ram, src.key)
    cloneFeed = clone.source || clone.metadata || clone
    clone.on('ready', startReplication)
  }

  var firstArgs = (isHyperdrive || isHyperDB) ? ['/first.txt', 'number 1', firstCallback] : ['first', firstCallback]
  var secondArgs = (isHyperdrive || isHyperDB) ? ['/second.txt', 'number 2', secondCallback] : ['second', secondCallback]
  var thirdArgs = (isHyperdrive || isHyperDB) ? ['/third.txt', 'number 3', thirdCallback] : ['first', thirdCallback]

  src.on('ready', function () {
    // generate source archive
    t.ok(srcFeed.writable)

    src[putFunction].apply(src, firstArgs)
  })

  function startReplication () {
    // wire up archives
    srcEphemeral.watchDat(src)
    cloneEphemeral.watchDat(clone)

    // listen to events
    var messageEventCount1 = 0
    srcEphemeral.on('message', onMessage1)
    cloneEphemeral.on('message', onMessage1)
    function onMessage1 (archive, peer, msg) {
      if (archive === src) {
        // received clone's data
        t.same(msg.contentType, 'application/json', 'received clone data')
        t.same(msg.payload.toString('utf8'), '"bar"', 'received clone data')
      }
      if (archive === clone) {
        // received src's data
        t.same(msg.contentType, 'application/json', 'received src data')
        t.same(msg.payload.toString('utf8'), '"foo"', 'received src data')
      }
      if (++messageEventCount1 === 2) {
        hasReceivedEvents1()
      }
    }

    // start replication
    var stream1 = clone.replicate({
      id: new Buffer('clone-stream'),
      live: true,
      extensions: ['ephemeral']
    })
    var stream2 = src.replicate({
      id: new Buffer('src-stream'),
      live: true,
      extensions: ['ephemeral']
    })
    stream1.pipe(stream2).pipe(stream1)

    // wait for handshakes
    var handshakeCount = 0
    stream1.on('handshake', gotHandshake)
    stream2.on('handshake', gotHandshake)

    function gotHandshake () {
      if (++handshakeCount !== 2) return

      // has support
      t.ok(srcEphemeral.hasSupport(src, srcFeed.peers[0]), 'src has support')
      t.ok(cloneEphemeral.hasSupport(clone, cloneFeed.peers[0]), 'clone has support')

      // send values
      srcEphemeral.send(src, srcFeed.peers[0], {contentType: 'application/json', payload: '"foo"'})
      cloneEphemeral.send(clone, cloneFeed.peers[0], {contentType: 'application/json', payload: '"bar"'})
    }

    function hasReceivedEvents1 () {
      srcEphemeral.removeListener('message', onMessage1)
      cloneEphemeral.removeListener('message', onMessage1)

      // listen to new events
      var messageEventCount2 = 0
      srcEphemeral.on('message', onMessageEvent2)
      cloneEphemeral.on('message', onMessageEvent2)
      function onMessageEvent2 (archive, peer, msg) {
        if (archive === src) {
          // received clone's data
          t.same(msg.contentType, 'application/octet-stream', 'received clone data')
          t.ok(msg.payload.equals(Buffer.from([4,3,2,1])), 'received clone data')
        }
        if (archive === clone) {
          // received src's data
          t.same(msg.contentType, '', 'received src data')
          t.ok(msg.payload.equals(Buffer.from([1,2,3,4])), 'received src data')
        }
        if (++messageEventCount2 === 2) {
          hasReceivedEvents2()
        }
      }

      // broadcast new values
      srcEphemeral.broadcast(src, {payload: Buffer.from([1,2,3,4])})
      cloneEphemeral.broadcast(clone, {contentType: 'application/octet-stream', payload: Buffer.from([4,3,2,1])})
    }

    function hasReceivedEvents2 () {
      // unwatch
      srcEphemeral.unwatchDat(src)
      cloneEphemeral.unwatchDat(clone)

      t.end()
    }
  }
})

tape('no peers causes no issue', function (t) {
  var ephemeral = new DatEphemeralExtMsg()

  var src = database(ram)
  src.on('ready', function () {
    ephemeral.watchDat(src)
    ephemeral.broadcast(src, {contentType: 'application/json', payload: '"test"'})
    t.pass('no error thrown')
    t.end()
  })
})

tape('fires received-bad-message', function (t) {
  // must use 2 instances to represent 2 different nodes
  var srcEphemeral = new DatEphemeralExtMsg()
  var cloneEphemeral = new DatEphemeralExtMsg()

  var src = database(ram)
  var srcFeed = src.source || src.metadata || src
  var clone
  var cloneFeed
  src.on('ready', function () {
    // generate clone instance
    clone = database(ram, src.key)
    cloneFeed = clone.source || clone.metadata || clone
    clone.on('ready', startReplication)
  })

  function startReplication () {
    // wire up archives
    srcEphemeral.watchDat(src)
    cloneEphemeral.watchDat(clone)

    // listen to events
    cloneEphemeral.on('received-bad-message', err => {
      t.ok(err instanceof Error, 'error was emitted')
      t.end()
    })

    // start replication
    var stream1 = clone.replicate({
      id: new Buffer('clone-stream'),
      live: true,
      extensions: ['ephemeral']
    })
    var stream2 = src.replicate({
      id: new Buffer('src-stream'),
      live: true,
      extensions: ['ephemeral']
    })
    stream1.pipe(stream2).pipe(stream1)

    // wait for handshakes
    var handshakeCount = 0
    stream1.on('handshake', gotHandshake)
    stream2.on('handshake', gotHandshake)

    function gotHandshake () {
      if (++handshakeCount !== 2) return

      // has support
      t.ok(srcEphemeral.hasSupport(src, srcFeed.peers[0]), 'src has support')
      t.ok(cloneEphemeral.hasSupport(clone, cloneFeed.peers[0]), 'clone has support')

      // send bad message
      srcFeed.peers[0].stream.extension('ephemeral', Buffer.from([0,1,2,3]))
    }
  }
})
