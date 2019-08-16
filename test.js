// @ts-check

const test = require('ava').default
const aggregate = require('./index.js').aggregate;

const setupTest = () => {
  const emitter = new (require('events').EventEmitter)
  return {
    emitter,
    add: (file, stat) => emitter.emit('add', file, stat),
    change: (file, stat) => emitter.emit('change', file, stat),
    unlink: (file, stat) => emitter.emit('unlink', file, stat),
  }
}


test.cb('should invoke callback upon adding', (t) => {
  const {emitter, add, change, unlink} = setupTest()
  t.plan(3)

  aggregate(emitter, ({ added, changed, unlinked }, done) => {
    t.deepEqual(added, [
      ['a', {}]
    ])

    t.deepEqual(changed, [])
    t.deepEqual(unlinked, [])
    done()
    t.end()
  })

  add('a', {})
})


test.cb('should invoke callback upon changing', (t) => {
  const {emitter, add, change, unlink} = setupTest()
  t.plan(3)

  aggregate(emitter, ({ added, changed, unlinked }, done) => {
    t.deepEqual(added, [])
    t.deepEqual(changed, [
      ['a', {}]
    ])
    t.deepEqual(unlinked, [])
    done()
    t.end()
  })

  change('a', {})
})


test.cb('should invoke callback upon unlinking', (t) => {
  const {emitter, add, change, unlink} = setupTest()
  t.plan(3)

  aggregate(emitter, ({ added, changed, unlinked }, done) => {
    t.deepEqual(added, [])
    t.deepEqual(changed, [])
    t.deepEqual(unlinked, [
      ['a', {}]
    ])
    done()
    t.end()
  })

  unlink('a', {})
})


test.cb('should allow passing setup callback and aggregate events until it completes', (t) => {
  const {emitter, add, change, unlink} = setupTest()
  let setupCalls = 0;
  let callbackCalls = 0;
  t.plan(7)

  function setup(done) {
    t.is(++setupCalls, 1)

    setTimeout(() => {
      t.pass('setup complete')
      unlink('c', {})
      done()
    }, 100)

    setTimeout(() => {
      change('b', {})
      t.pass('change during setup')
    }, 50)
  }

  aggregate(emitter, (changes, done) => {
    t.is(++callbackCalls, 1)

    t.deepEqual(changes.added, [['a', {}]])
    t.deepEqual(changes.changed, [['b', {}]])
    t.deepEqual(changes.unlinked, [['c', {}]])
    done()
    t.end()
  }, setup)

  add('a', {})
})


test.cb('should aggregate events while callback is executing', (t) => {
  const {emitter, add, change, unlink} = setupTest()
  let callbackCalls = 0
  t.plan(12)

  const callHandlers = [
    (changes) => {
      add('a')
      add('b')

      t.is(callbackCalls, 1)
      t.deepEqual(changes.added, [['a']])
      t.deepEqual(changes.changed, [])
      t.deepEqual(changes.unlinked, [])
    },

    (changes) => {
      change('a')
      unlink('b')

      t.is(callbackCalls, 2)
      t.deepEqual(changes.added, [['a'], ['b']])
      t.deepEqual(changes.changed, [])
      t.deepEqual(changes.unlinked, [])
    },

    (changes) => {
      t.is(callbackCalls, 3)
      t.deepEqual(changes.added, [])
      t.deepEqual(changes.changed, [['a']])
      t.deepEqual(changes.unlinked, [['b']])

      t.end()
    },
  ]

  aggregate(emitter, (changes, done) => {
    callHandlers[callbackCalls++](changes)
    done()
  })

  add('a')
})


test.cb('should "flatten" out opposte events in single aggregation frame', (t) => {
  const {emitter, add, change, unlink} = setupTest()
  t.plan(3)

  aggregate(emitter, (changes, done) => {
    t.deepEqual(changes.added, [
      ['c']
    ])

    t.deepEqual(changes.changed, [
      ['a']
    ])

    t.deepEqual(changes.unlinked, [
      ['d']
    ])

    t.end()
    done()
  })

  unlink('a')
  add('a')

  add('b')
  unlink('b')

  add('c')
  change('c')

  unlink('d')
  add('d')
  change('d')
  unlink('d')
})