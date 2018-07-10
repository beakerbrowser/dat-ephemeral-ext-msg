# dat-ephemeral-ext-msg

Methods for implementing ephemeral messages as extension messages over Dat. [Read the spec here.](./spec.md)

```js
const {DatEphemeralExtMsg} = require('@beaker/dat-ephemeral-ext-msg')
var datEphemeralExtMsg = new DatEphemeralExtMsg()

/**
 * Step 1. Register the 'ephemeral' extension in the protocol streams
 */
var mySwarm = discoverySwarm(swarmDefaults({
  stream (info) {
    // add to the the protocol stream
    var stream = hypercoreProtocol({
      extensions: ['ephemeral']
    })
    // ...
    return stream
  }
}))

/**
 * Step 2. Wire up each dat you create
 */
datEphemeralExtMsg.watchDat(archiveOrHypercore) // can give a hyperdrive or hypercore
// datEphemeralExtMsg.unwatchDat(archiveOrHypercore) when done

/**
 * Step 3. Listen to events
 */
datEphemeralExtMsg.on('message', (archiveOrHypercore, peer, {contentType, payload}) => {
  // `peer` has sent `payload` of mimetype `contentType` for `archiveOrHypercore`
})
datEphemeralExtMsg.on('received-bad-message', (err, archiveOrHypercore, peer, messageBuffer) => {
  // there was an error parsing a received message
})

/**
 * Step 4. Use the API
 */
datEphemeralExtMsg.hasSupport(archiveOrHypercore, peerId)
datEphemeralExtMsg.broadcast(archiveOrHypercore, {contentType, payload})
datEphemeralExtMsg.send(archiveOrHypercore, peerId, {contentType, payload})
```
