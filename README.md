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
    return streams
  }
}))

/**
 * Step 2. Wire up each dat you create
 */
datEphemeralExtMsg.watchDat(database) // can pass a hypercore, hyperdb, or hyperdrive reference as the database
// datEphemeralExtMsg.unwatchDat(database) when done

/**
 * Step 3. Listen to events
 */
datEphemeralExtMsg.on('message', (database, peer, {contentType, payload}) => {
  // `peer` has sent `payload` of mimetype `contentType` for `database`
})
datEphemeralExtMsg.on('received-bad-message', (err, database, peer, messageBuffer) => {
  // there was an error parsing a received message
})

/**
 * Step 4. Use the API
 */
datEphemeralExtMsg.hasSupport(database, peerId)
datEphemeralExtMsg.broadcast(database, {contentType, payload})
datEphemeralExtMsg.send(database, peerId, {contentType, payload})
```
