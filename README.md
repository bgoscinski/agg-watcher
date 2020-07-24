# agg-watcher

Aggregates `add`, `change` and `unlink` file events that happen while some async
action is in progress.

# API

`aggregate(eventEmitter, callback, [setup])`

Where:

- `eventEmitter` - is anything which emits `add`, `change` and `unlink` events
  with optional `Stat` object as event payload
- `callback` - will be called with minimal set of changes that describe what
  happened since last call. This function can return a `Promise` to delay
  subsequent calls until completition
- `setup` - will be called just after initialization. This function can return a
  `Promise` to delay `callback` calls until completition

# Example

```js
const { aggregate } = require('agg-watcher')

aggregate(chokidar, async ({ added, changed, unlinked }) => {
  // this fn won't be called again previous invocation completes

  const all = [...added, ...changed, ...unlinked]
  for (const [path, maybeStat] of all) {
    console.log(path, maybeStat && maybeStat.mtime)
  }

  await doSomethingAsync(added, changed, unlinked)
})
```
