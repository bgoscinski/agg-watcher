'use strict'

exports.watch = function aggregatingWatcher (dirs, opts, fn) {
  const unlinked = new Map()
  const changed = new Map()
  const added = new Map()
  let isExecuting = false
  let watcher

  if (typeof opts === 'function') {
    fn = opts
    opts = {}
  }

  if (!opts) {
    opts = {}
  }

  if (typeof fn !== 'function') {
    throw new TypeError(`'fn' parameter expected to be function`);
  }

  const chokidarOpts = {}
  let throttle = 100
  Object.keys(opts).forEach((key) => {
    const value = opts[key]

    switch (key) {
      case 'throttle': throttle = value === false ? value : Math.max(0, +value); break
      default: chokidarOpts[key] = opts[key]
    }
  })

  const isNonEmpty = () => 0 < (
    added.size +
    changed.size +
    unlinked.size
  )

  const pop = () => {
    const ret = {
      unlinked: Array.from(unlinked.values()),
      changed: Array.from(changed.values()),
      added: Array.from(added.values())
    }

    unlinked.clear()
    changed.clear()
    added.clear()

    return ret
  }

  const tryExecute = () => {
    if (!isExecuting && isNonEmpty()) {
      isExecuting = true

      const execute = (done) => fn(pop(), done)
      const attempt = () => {
        require('async-done')(execute, (err) => {
          isExecuting = false
          if (err) watcher.emit('error', err)
          tryExecute()
        })
      }

      if (throttle === false) {
        attempt()
      } else {
        setTimeout(attempt, throttle)
      }
    }
  }

  const unlinkAggregator = (path, stat) => {
    const value = arguments.length > 1 ? [path, stat] : [path]
    added.delete(path)
    changed.delete(path)
    unlinked.set(path, value)
    tryExecute()
  }

  const changeAggregator = (path, stat) => {
    const value = arguments.length > 1 ? [path, stat] : [path]
    changed.set(path, value)
    tryExecute()
  }

  const addAggregator = (path, stat) => {
    const value = arguments.length > 1 ? [path, stat] : [path]
    if (unlinked.has(path)) {
      unlinked.delete(path)
      changed.set(path, value)
    } else {
      added.set(path, value)
    }
    tryExecute()
  }

  return watcher = require('chokidar').watch(dirs, chokidarOpts)
    .on('unlink', unlinkAggregator)
    .on('change', changeAggregator)
    .on('add', addAggregator)
}
