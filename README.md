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
datEphemeralExtMsg.watchDat(dat) // can pass a hypercore, hyperdb, or hyperdrive reference as the dat
// datEphemeralExtMsg.unwatchDat(dat) when done

/**
 * Step 3. Listen to events
 */
datEphemeralExtMsg.on('message', (dat, peer, {contentType, payload}) => {
  // `peer` has sent `payload` of mimetype `contentType` for `dat`
})
datEphemeralExtMsg.on('received-bad-message', (err, dat, peer, messageBuffer) => {
  // there was an error parsing a received message
})

/**
 * Step 4. Use the API
 */
datEphemeralExtMsg.hasSupport(dat, peerId)
datEphemeralExtMsg.broadcast(dat, {contentType, payload})
datEphemeralExtMsg.send(dat, peerId, {contentType, payload})
```
