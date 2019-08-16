// @ts-check

'use strict'

const debug = require('debug')('agg-watcher')

const isEventEmitter = maybeEmitter =>
  typeof maybeEmitter === 'object' &&
  typeof maybeEmitter.on === 'function' &&
  typeof maybeEmitter.emit === 'function'

const isCallback = maybeCallback => typeof maybeCallback === 'function'

exports.aggregate = function(emitter, callback, setup) {
  if (!isEventEmitter(emitter)) {
    throw new TypeError(
      `First parameter expected to be an EventEmitter instance. Got ${emitter}`,
    )
  }

  if (!isCallback(callback)) {
    throw new TypeError(
      `Second parameter expected to be a function. Got ${callback}`,
    )
  }

  if (setup && !isCallback(setup)) {
    throw new TypeError(
      `Third parameter expected to be a function. Got ${setup}`,
    )
  }

  const unlinked = new Map()
  const changed = new Map()
  const added = new Map()

  const hasValues = () => unlinked.size || changed.size || added.size

  const popCache = () => {
    const cache = {
      unlinked: Array.from(unlinked.values()),
      changed: Array.from(changed.values()),
      added: Array.from(added.values()),
    }

    unlinked.clear()
    changed.clear()
    added.clear()

    return cache
  }

  const executeCallback = done => {
    if (hasValues()) {
      const cache = popCache()
      debug('executing fn')
      return callback(cache, done)
    } else {
      debug('execution skipped - cache empty')
      done()
    }
  }

  let isExecuting = false
  const scheduleExecute = () => {
    debug('requested scheduling execution')

    if (!isExecuting && hasValues()) {
      isExecuting = true
      require('async-done')(executeCallback, err => {
        debug('execution complete')
        isExecuting = false
        if (err) emitter.emit('error', err)
        scheduleExecute()
      })

      debug('execution scheduled')
    } else {
      debug('execution schedule skipped')
    }
  }

  if (setup) {
    isExecuting = true
    require('async-done')(setup, () => {
      isExecuting = false
      scheduleExecute()
    })
  }

  const onUnlink = createUnlinkAggregator({ unlinked, changed, added })
  emitter.on('unlink', (path, maybeStat) => {
    debug('unlink', path, maybeStat)
    onUnlink(path, maybeStat ? [path, maybeStat] : [path])
    scheduleExecute()
  })

  const onChange = createChangeAggregator({ unlinked, changed, added })
  emitter.on('change', (path, maybeStat) => {
    debug('change', path, maybeStat)
    onChange(path, maybeStat ? [path, maybeStat] : [path])
    scheduleExecute()
  })

  const onAdd = createAddAggregator({ unlinked, changed, added })
  emitter.on('add', (path, maybeStat) => {
    debug('add', path, maybeStat)
    onAdd(path, maybeStat ? [path, maybeStat] : [path])
    scheduleExecute()
  })

  return emitter
}

const createUnlinkAggregator = ({ unlinked, changed, added }) => (
  key,
  args,
) => {
  if (added.has(key)) {
    // was added, now is deleted => noop
    added.delete(key)
  } else {
    changed.delete(key)
    unlinked.set(key, args)
  }
}

const createChangeAggregator = ({ unlinked, changed, added }) => (
  key,
  args,
) => {
  if (!added.has(key)) {
    changed.set(key, args)
  }
}

const createAddAggregator = ({ unlinked, changed, added }) => (key, args) => {
  if (unlinked.has(key)) {
    unlinked.delete(key)
    changed.set(key, args)
  } else {
    added.set(key, args)
  }
}
