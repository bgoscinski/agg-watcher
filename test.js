// @ts-check

const test = require('ava').default
const aggregate = require('./index.js').aggregate

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const setupTest = () => {
  const emitter = new (require('events').EventEmitter)()
  return {
    emitter,
    add: (file, stat) => emitter.emit('add', file, stat),
    change: (file, stat) => emitter.emit('change', file, stat),
    unlink: (file, stat) => emitter.emit('unlink', file, stat),
  }
}

function flow(handlers) {
  let calls = 0
  return (...args) => {
    const handler = handlers[calls++]
    if (handler) return handler(...args)
    throw Error(
      `Callback called ${calls} times but expected only ${handlers.length}`,
    )
  }
}

test.cb('should invoke callback upon adding', (t) => {
  const { emitter, add, change, unlink } = setupTest()
  t.plan(3)

  aggregate(emitter, (changes) => {
    t.deepEqual(changes.added, [['a', {}]])
    t.deepEqual(changes.changed, [])
    t.deepEqual(changes.unlinked, [])
    t.end()
  })

  add('a', {})
})

test.cb('should invoke callback upon changing', (t) => {
  const { emitter, add, change, unlink } = setupTest()
  t.plan(3)

  aggregate(emitter, (changes) => {
    t.deepEqual(changes.added, [])
    t.deepEqual(changes.changed, [['a', {}]])
    t.deepEqual(changes.unlinked, [])
    t.end()
  })

  change('a', {})
})

test.cb('should invoke callback upon unlinking', (t) => {
  const { emitter, add, change, unlink } = setupTest()
  t.plan(3)

  aggregate(emitter, (changes) => {
    t.deepEqual(changes.added, [])
    t.deepEqual(changes.changed, [])
    t.deepEqual(changes.unlinked, [['a', {}]])
    t.end()
  })

  unlink('a', {})
})

test.cb(
  'should allow passing setup callback and aggregate events until it completes',
  (t) => {
    const { emitter, add, change, unlink } = setupTest()
    let setupCalls = 0
    t.plan(6)

    aggregate(
      emitter,
      (changes) => {
        t.deepEqual(changes.added, [['a', {}]])
        t.deepEqual(changes.changed, [['b', {}]])
        t.deepEqual(changes.unlinked, [['c', {}]])
        t.end()
      },
      () => {
        t.is(++setupCalls, 1)

        return Promise.all([
          delay(100).then(() => {
            t.pass('setup complete')
            unlink('c', {})
          }),
          delay(50).then(() => {
            t.pass('change during setup')
            change('b', {})
          }),
        ])
      },
    )

    add('a', {})
  },
)

test.cb('should aggregate events while callback is executing', (t) => {
  const { emitter, add, change, unlink } = setupTest()
  t.plan(9)

  aggregate(
    emitter,
    flow([
      async (changes) => {
        add('a')

        t.deepEqual(changes.added, [['a']])
        t.deepEqual(changes.changed, [])
        t.deepEqual(changes.unlinked, [])

        await delay(50)
        add('b')
      },

      async (changes) => {
        change('a')

        t.deepEqual(changes.added, [['a'], ['b']])
        t.deepEqual(changes.changed, [])
        t.deepEqual(changes.unlinked, [])

        await delay(1)
        unlink('b')
      },

      (changes) => {
        t.deepEqual(changes.added, [])
        t.deepEqual(changes.changed, [['a']])
        t.deepEqual(changes.unlinked, [['b']])

        t.end()
      },
    ]),
  )

  add('a')
})

test.cb(
  'should "flatten" out opposite events in single aggregation frame',
  (t) => {
    const { emitter, add, change, unlink } = setupTest()
    t.plan(3)

    aggregate(emitter, (changes) => {
      t.deepEqual(changes.added, [['c']])
      t.deepEqual(changes.changed, [['a']])
      t.deepEqual(changes.unlinked, [['d']])
      t.end()
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
  },
)
