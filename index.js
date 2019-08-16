// @ts-check

'use strict'

const debug = require('debug')('agg-watcher')

exports.aggregate = aggregate

function aggregate(emitter, callback, setup) {
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

  const aggUnlink = createUnlinkAggregator({ unlinked, changed, added })
  emitter.on('unlink', function onUnlink(path, maybeStat) {
    debug('unlink', path, maybeStat)
    aggUnlink(path, maybeStat ? [path, maybeStat] : [path])
    scheduleExecute()
  })

  const aggChange = createChangeAggregator({ unlinked, changed, added })
  emitter.on('change', function onChange(path, maybeStat) {
    debug('change', path, maybeStat)
    aggChange(path, maybeStat ? [path, maybeStat] : [path])
    scheduleExecute()
  })

  const aggAdd = createAddAggregator({ unlinked, changed, added })
  emitter.on('add', function onAdd(path, maybeStat) {
    debug('add', path, maybeStat)
    aggAdd(path, maybeStat ? [path, maybeStat] : [path])
    scheduleExecute()
  })

  return emitter
}

function createUnlinkAggregator({ unlinked, changed, added }) {
  return function aggregateUnlink(key, args) {
    if (added.has(key)) {
      // was added, now is deleted => noop
      added.delete(key)
    } else {
      changed.delete(key)
      unlinked.set(key, args)
    }
  }
}

function createChangeAggregator({ unlinked, changed, added }) {
  return function aggregateChange(key, args) {
    if (!added.has(key)) {
      changed.set(key, args)
    }
  }
}

function createAddAggregator({ unlinked, changed, added }) {
  return function aggregateAdd(key, args) {
    if (unlinked.has(key)) {
      unlinked.delete(key)
      changed.set(key, args)
    } else {
      added.set(key, args)
    }
  }
}

function isEventEmitter(maybeEmitter) {
  return (
    typeof maybeEmitter === 'object' &&
    typeof maybeEmitter.on === 'function' &&
    typeof maybeEmitter.emit === 'function'
  )
}

function isCallback(maybeCallback) {
  return typeof maybeCallback === 'function'
}
