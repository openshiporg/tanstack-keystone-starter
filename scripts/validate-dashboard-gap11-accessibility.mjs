import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import {
  processGroupExists,
  runBoundedChild,
  terminateChildGroup,
} from './lib/bounded-child.mjs'

const firefoxBinary =
  process.env.FIREFOX_BIN ?? '/Applications/Firefox.app/Contents/MacOS/firefox'
const serverEntry = path.resolve('.output/server/index.mjs')
const processes = []
let appLog = ''
let firefoxLog = ''

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      assert.ok(address && typeof address === 'object')
      const { port } = address
      server.close((error) => (error ? reject(error) : resolve(port)))
    })
  })
}

async function waitFor(check, description, timeout = 30_000) {
  const deadline = Date.now() + timeout
  let lastError
  while (Date.now() < deadline) {
    try {
      if (await check()) return
      lastError = undefined
    } catch (error) {
      lastError = error
    }
    await sleep(100)
  }
  throw new Error(
    `Timed out waiting for ${description}${lastError ? `: ${String(lastError)}` : ''}`,
  )
}

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  processes.push(child)
  return child
}

async function stopProcesses() {
  const results = await Promise.allSettled(
    processes.toReversed().map(async (child) => {
      if (!child.pid || !processGroupExists(child.pid)) return
      await terminateChildGroup(child, 'GAP-11 accessibility child process')
    }),
  )
  const errors = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason)
  if (errors.length > 0)
    throw new AggregateError(errors, 'GAP-11 child cleanup failed')
}

async function profileBoundProcesses(profileDirectory) {
  const { stdout } = await runBoundedChild(
    '/bin/ps',
    ['-axo', 'pid=,command='],
    {
      label: 'GAP-11 profile-bound Firefox discovery',
      timeout: 5_000,
      captureOutput: true,
      maxCapturedBytes: 4 * 1024 * 1024,
    },
  )
  return stdout
    .split('\n')
    .map((line) => line.match(/^\s*(\d+)\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({ pid: Number(match[1]), command: match[2] }))
    .filter(({ command }) => command.includes(profileDirectory))
}

function signalPid(pid, signal) {
  try {
    process.kill(pid, signal)
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
}

async function terminateProfileBoundProcesses(profileDirectory) {
  for (const { pid } of await profileBoundProcesses(profileDirectory))
    signalPid(pid, 'SIGTERM')
  await sleep(300)
  for (const { pid } of await profileBoundProcesses(profileDirectory))
    signalPid(pid, 'SIGKILL')
  await waitFor(
    async () => (await profileBoundProcesses(profileDirectory)).length === 0,
    'GAP-11 profile-bound Firefox cleanup',
    5_000,
  )
}

class BidiClient {
  constructor(url) {
    this.url = url
    this.nextId = 0
    this.pending = new Map()
    this.events = []
  }

  async connect() {
    this.socket = new WebSocket(this.url)
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      const pending =
        message.id === undefined ? undefined : this.pending.get(message.id)
      if (pending) {
        this.pending.delete(message.id)
        clearTimeout(pending.timer)
        if (message.type === 'error')
          pending.reject(new Error(`${message.error}: ${message.message}`))
        else pending.resolve(message.result)
      } else if (message.type === 'event') {
        this.events.push(message)
      }
    })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out connecting to Firefox BiDi')),
        10_000,
      )
      this.socket.addEventListener(
        'open',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true },
      )
      this.socket.addEventListener(
        'error',
        (error) => {
          clearTimeout(timer)
          reject(error)
        },
        { once: true },
      )
    })
  }

  command(method, params = {}, timeout = 30_000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for ${method}`))
      }, timeout)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    this.socket?.close()
  }
}

function readSeededCredentials(source) {
  const identity = source.match(/\bemail:\s*'([^']+)'/)?.[1]
  const secret = source.match(
    /\bpassword:\s*hashPasswordSync\('([^']+)'\)/,
  )?.[1]
  assert.ok(identity, 'Could not discover the seeded dashboard identity')
  assert.ok(secret, 'Could not discover the seeded dashboard secret')
  return { identity, secret }
}

async function runBrowserFlow(webSocketBase, appBase, credentials) {
  const bidi = new BidiClient(`${webSocketBase}/session`)
  await bidi.connect()
  let context
  let intentionalNotFoundPath = null

  async function evaluate(expression) {
    const result = await bidi.command('script.evaluate', {
      expression,
      target: { context },
      awaitPromise: true,
      resultOwnership: 'none',
    })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }

  async function evaluateJson(expression) {
    return JSON.parse(await evaluate(`JSON.stringify(${expression})`))
  }

  async function locate(selector) {
    const result = await bidi.command('browsingContext.locateNodes', {
      context,
      locator: { type: 'css', value: selector },
      maxNodeCount: 1,
    })
    assert.equal(result.nodes.length, 1, `Expected one node for ${selector}`)
    return result.nodes[0]
  }

  async function click(selector) {
    const node = await locate(selector)
    await bidi.command('script.callFunction', {
      functionDeclaration:
        '(element) => element.scrollIntoView({ block: "center", inline: "center" })',
      target: { context },
      awaitPromise: false,
      arguments: [{ sharedId: node.sharedId }],
      resultOwnership: 'none',
    })
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'pointer',
          id: 'mouse',
          parameters: { pointerType: 'mouse' },
          actions: [
            {
              type: 'pointerMove',
              x: 0,
              y: 0,
              duration: 0,
              origin: { type: 'element', element: { sharedId: node.sharedId } },
            },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }

  async function waitForPage(expression, description, timeout = 30_000) {
    try {
      await waitFor(() => evaluate(expression), description, timeout)
    } catch (error) {
      console.error(`Browser state while waiting for ${description}:`, {
        location: await evaluate('location.href'),
        body: await evaluate('document.body.innerText'),
      })
      throw error
    }
  }

  async function navigate(route) {
    await bidi.command('browsingContext.navigate', {
      context,
      url: `${appBase}${route}`,
      wait: 'complete',
    })
    await sleep(200)
    await waitForPage(
      `location.pathname === ${JSON.stringify(new URL(route, appBase).pathname)}`,
      `navigation to ${route}`,
    )
  }

  async function accessibilityNodes(role, name) {
    const value = name === undefined ? { role } : { role, name }
    const result = await bidi.command('browsingContext.locateNodes', {
      context,
      locator: { type: 'accessibility', value },
      maxNodeCount: 100,
    })
    return result.nodes
  }

  async function pressKey(value) {
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            { type: 'keyDown', value },
            { type: 'keyUp', value },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }

  async function pressChord(modifier, value) {
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'key',
          id: 'keyboard',
          actions: [
            { type: 'keyDown', value: modifier },
            { type: 'keyDown', value },
            { type: 'keyUp', value },
            { type: 'keyUp', value: modifier },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
  }

  async function typeCharacters(value) {
    const actions = Array.from(value).flatMap((character) => [
      { type: 'keyDown', value: character },
      { type: 'keyUp', value: character },
    ])
    await bidi.command('input.performActions', {
      context,
      actions: [{ type: 'key', id: 'keyboard', actions }],
    })
    await bidi.command('input.releaseActions', { context })
  }

  async function focusSelector(selector) {
    const focused = await evaluate(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)})
      if (!(node instanceof HTMLElement)) return false
      node.focus()
      return document.activeElement === node
    })()`)
    assert.equal(focused, true, `Could not focus ${selector}`)
  }

  async function focusExpression(expression, description) {
    const focused = await evaluate(`(() => {
      const node = ${expression}
      if (!(node instanceof HTMLElement)) return false
      node.focus()
      return document.activeElement === node
    })()`)
    assert.equal(focused, true, `Could not focus ${description}`)
  }

  async function activateFocusedButton(description) {
    await evaluate(`(() => {
      const node = document.activeElement
      globalThis.__gap11ActivationEvents = []
      for (const type of ['keydown', 'keyup', 'pointerdown', 'click'])
        node.addEventListener(type, event => {
          globalThis.__gap11ActivationEvents?.push({
            type,
            key: event.key ?? null,
            trusted: event.isTrusted,
          })
        }, { once: true })
    })()`)
    for (const value of ['\uE006', '\uE007', '\uE00D', ' ']) {
      await pressKey(value)
      const evidence = await evaluateJson(
        `globalThis.__gap11ActivationEvents ?? []`,
      )
      const clickEvent = evidence.find((event) => event.type === 'click')
      if (clickEvent) {
        assert.equal(
          clickEvent.trusted,
          true,
          `${description} click was untrusted`,
        )
        await evaluate('delete globalThis.__gap11ActivationEvents')
        console.log(
          `[gap11-keyboard-activation] ${JSON.stringify({ description, key: value.codePointAt(0).toString(16), nativeClickSynthesized: true, evidence })}`,
        )
        return
      }
    }

    // Firefox BiDi currently delivers trusted keydown/keyup events without
    // synthesizing the native button click. Keep the keyboard-event evidence,
    // then use one trusted pointer activation only to continue the focus test.
    const activeResult = await bidi.command('script.evaluate', {
      expression: 'document.activeElement',
      target: { context },
      awaitPromise: false,
      resultOwnership: 'root',
    })
    assert.ok(activeResult.result.sharedId, `${description} lost focus`)
    await bidi.command('input.performActions', {
      context,
      actions: [
        {
          type: 'pointer',
          id: 'mouse',
          parameters: { pointerType: 'mouse' },
          actions: [
            {
              type: 'pointerMove',
              x: 0,
              y: 0,
              duration: 0,
              origin: {
                type: 'element',
                element: { sharedId: activeResult.result.sharedId },
              },
            },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ],
    })
    await bidi.command('input.releaseActions', { context })
    const evidence = await evaluateJson(
      `globalThis.__gap11ActivationEvents ?? []`,
    )
    const activationEvent = evidence.find((event) =>
      ['pointerdown', 'click'].includes(event.type),
    )
    assert.ok(
      activationEvent,
      `${description} trusted pointer fallback did not activate`,
    )
    assert.equal(
      activationEvent.trusted,
      true,
      `${description} fallback was untrusted`,
    )
    await evaluate('delete globalThis.__gap11ActivationEvents')
    console.log(
      `[gap11-keyboard-activation] ${JSON.stringify({ description, nativeClickSynthesized: false, evidence })}`,
    )
  }

  async function assertRouteSemantics(label, expectedMainName) {
    const evidence = await evaluateJson(`(() => {
      const idCounts = new Map()
      for (const node of document.querySelectorAll('[id]'))
        idCounts.set(node.id, (idCounts.get(node.id) ?? 0) + 1)
      const invalidReferences = []
      for (const node of document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]')) {
        for (const attribute of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
          const value = node.getAttribute(attribute)
          if (!value) continue
          for (const id of value.split(/\\s+/)) {
            if (id && !document.getElementById(id))
              invalidReferences.push({ attribute, id, node: node.outerHTML.slice(0, 180) })
          }
        }
      }
      return {
        path: location.pathname,
        mainCount: document.querySelectorAll('main').length,
        mainLabels: Array.from(document.querySelectorAll('main')).map(node => node.getAttribute('aria-label')),
        nestedMainCount: document.querySelectorAll('main main').length,
        h1: Array.from(document.querySelectorAll('h1')).filter(node => {
          const style = getComputedStyle(node)
          return !node.closest('[aria-hidden=true], [inert]') && style.display !== 'none' && style.visibility !== 'hidden'
        }).map(node => node.textContent.trim()),
        duplicateIds: Array.from(idCounts).filter(([, count]) => count > 1),
        invalidReferences,
        disabledBreadcrumbLinks: document.querySelectorAll('[data-slot=breadcrumb-page][role=link], [data-slot=breadcrumb-page][aria-disabled=true]').length,
        currentPages: Array.from(document.querySelectorAll('[aria-current=page]')).map(node => node.textContent.trim()),
        focusInsideHiddenContent: Boolean(document.activeElement?.closest('[aria-hidden=true], [inert]')),
      }
    })()`)
    assert.equal(evidence.mainCount, 1, `${label} must expose exactly one main`)
    assert.equal(
      evidence.nestedMainCount,
      0,
      `${label} must not nest main landmarks`,
    )
    assert.equal(evidence.h1.length, 1, `${label} must expose exactly one h1`)
    assert.deepEqual(evidence.duplicateIds, [], `${label} has duplicate ids`)
    assert.deepEqual(
      evidence.invalidReferences,
      [],
      `${label} has broken ARIA references`,
    )
    assert.equal(evidence.disabledBreadcrumbLinks, 0)
    assert.equal(evidence.focusInsideHiddenContent, false)
    assert.ok(evidence.currentPages.length > 0, `${label} has no current page`)

    await waitFor(
      async () =>
        (await accessibilityNodes('navigation', 'Primary navigation'))
          .length === 1,
      `${label} primary navigation accessibility node`,
      5_000,
    )
    await waitFor(
      async () =>
        (await accessibilityNodes('link', 'Skip to dashboard content'))
          .length === 1,
      `${label} skip-link accessibility node`,
      5_000,
    )
    if (expectedMainName !== undefined)
      assert.deepEqual(
        evidence.mainLabels,
        [expectedMainName],
        `${label} must name its main landmark`,
      )
    await waitFor(
      async () => (await accessibilityNodes('main')).length === 1,
      `${label} main accessibility node`,
      5_000,
    )
  }

  async function assertSkipLink() {
    await focusSelector('a[href="#dashboard-main-content"]')
    assert.equal(
      await evaluate(
        "document.activeElement?.textContent.trim() === 'Skip to dashboard content'",
      ),
      true,
    )
    await pressKey('\uE007')
    await waitForPage(
      "location.hash === '#dashboard-main-content' && document.activeElement?.id === 'dashboard-main-content'",
      'skip-link target focus',
    )
  }

  async function keyboardTraverse(label) {
    const expected = await evaluateJson(`(() => {
      document.querySelectorAll('[data-gap11-focus-key]').forEach(node => node.removeAttribute('data-gap11-focus-key'))
      const selector = 'a[href], button, input, select, textarea, summary, [contenteditable=true], [tabindex]'
      const candidates = Array.from(document.querySelectorAll(selector)).filter(node => {
        if (!(node instanceof HTMLElement)) return false
        if (node.matches(':disabled, [disabled], [tabindex="-1"]')) return false
        if (node.closest('[inert], [aria-hidden="true"]')) return false
        if (node.tabIndex < 0) return false
        const style = getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      })
      const radioGroups = new Map()
      for (const node of candidates) {
        if (!(node instanceof HTMLInputElement) || node.type !== 'radio') continue
        const key = node.name || '__unnamed-radio'
        const group = radioGroups.get(key) ?? []
        group.push(node)
        radioGroups.set(key, group)
      }
      const tabbable = candidates.filter(node => {
        if (!(node instanceof HTMLInputElement) || node.type !== 'radio') return true
        const group = radioGroups.get(node.name || '__unnamed-radio') ?? []
        const checked = group.find(entry => entry.checked)
        return checked ? checked === node : group[0] === node
      })
      const ordered = [
        ...tabbable.filter(node => node.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex),
        ...tabbable.filter(node => node.tabIndex === 0),
      ]
      const accessibleName = node => {
        const ariaLabel = node.getAttribute('aria-label')?.trim()
        if (ariaLabel) return ariaLabel
        const labelledBy = node.getAttribute('aria-labelledby')
        if (labelledBy) {
          const value = labelledBy.split(/\\s+/).map(id => document.getElementById(id)?.textContent.trim() ?? '').filter(Boolean).join(' ')
          if (value) return value
        }
        if (node.id) {
          const label = Array.from(document.querySelectorAll('label')).find(candidate => candidate.htmlFor === node.id)
          if (label?.textContent.trim()) return label.textContent.trim()
        }
        const wrappingLabel = node.closest('label')?.textContent.trim()
        if (wrappingLabel) return wrappingLabel
        const alt = node.getAttribute('alt')?.trim()
        if (alt) return alt
        const title = node.getAttribute('title')?.trim()
        if (title) return title
        return node.textContent?.trim() ?? ''
      }
      return ordered.map((node, index) => {
        const key = 'gap11-focus-' + index
        node.setAttribute('data-gap11-focus-key', key)
        return {
          key,
          name: accessibleName(node),
          tag: node.tagName.toLowerCase(),
          role: node.getAttribute('role'),
          html: node.outerHTML.slice(0, 220),
        }
      })
    })()`)
    assert.ok(expected.length > 2, `${label} has too few keyboard controls`)
    assert.deepEqual(
      expected.filter((entry) => !entry.name),
      [],
      `${label} has unnamed keyboard controls`,
    )
    await focusSelector(`[data-gap11-focus-key="${expected[0].key}"]`)
    const observed = [expected[0].key]
    for (let index = 1; index < expected.length; index += 1) {
      await pressKey('\uE004')
      const active = await evaluateJson(`(() => ({
        key: document.activeElement?.getAttribute('data-gap11-focus-key') ?? null,
        hidden: Boolean(document.activeElement?.closest('[inert], [aria-hidden=true]')),
        html: document.activeElement?.outerHTML?.slice(0, 220) ?? '',
      }))()`)
      assert.equal(active.hidden, false, `${label} focused hidden content`)
      assert.equal(
        active.key,
        expected[index].key,
        `${label} tab order diverged at ${index}: ${JSON.stringify({ expected: expected[index], active })}`,
      )
      observed.push(active.key)
    }
    assert.deepEqual(
      observed,
      expected.map((entry) => entry.key),
    )
    console.log(
      `[gap11-keyboard] ${JSON.stringify({ label, controls: expected.length, names: expected.map((entry) => entry.name) })}`,
    )
  }

  async function assertModalKeyboard(
    role,
    name,
    triggerDescription,
    { fullCycle = true } = {},
  ) {
    assert.equal((await accessibilityNodes(role, name)).length, 1)
    const rootSelector = `[role=${JSON.stringify(role)}]`
    const initialState = await evaluateJson(`(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)})
      const focusables = Array.from(root?.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])') ?? []).filter(node => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return !node.matches(':disabled') && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      })
      return {
        focusCount: focusables.length,
        focusContained: Boolean(root?.contains(document.activeElement)),
      }
    })()`)
    assert.ok(initialState.focusCount >= 2, `${name} needs keyboard actions`)
    assert.equal(
      initialState.focusContained,
      true,
      `${name} must receive focus`,
    )
    const forwardSteps = fullCycle
      ? initialState.focusCount + 2
      : Math.min(2, initialState.focusCount)
    for (let index = 0; index < forwardSteps; index += 1) {
      await pressKey('\uE004')
      await sleep(25)
      const focusState = await evaluateJson(`(() => {
        const root = document.querySelector(${JSON.stringify(rootSelector)})
        return {
          contained: root?.contains(document.activeElement) === true,
          focusGuard: document.activeElement?.hasAttribute('data-base-ui-focus-guard') === true,
          body: document.activeElement === document.body,
          active: document.activeElement?.outerHTML?.slice(0, 260) ?? '',
          activeText: document.activeElement?.textContent?.trim() ?? '',
        }
      })()`)
      for (
        let guardAttempt = 0;
        !focusState.contained &&
        (focusState.focusGuard || focusState.body) &&
        guardAttempt < 6;
        guardAttempt += 1
      ) {
        await pressKey('\uE004')
        await sleep(25)
        const nextState = await evaluateJson(`(() => ({
          contained: document.querySelector(${JSON.stringify(rootSelector)})?.contains(document.activeElement) === true,
          focusGuard: document.activeElement?.hasAttribute('data-base-ui-focus-guard') === true,
          body: document.activeElement === document.body,
          active: document.activeElement?.outerHTML?.slice(0, 260) ?? '',
          activeText: document.activeElement?.textContent?.trim() ?? '',
        }))()`)
        Object.assign(focusState, nextState)
      }
      assert.equal(
        focusState.contained,
        true,
        `${name} must contain forward Tab focus at step ${index}: ${JSON.stringify(focusState)}`,
      )
    }
    await pressChord('\uE008', '\uE004')
    await sleep(25)
    let reverseContained = await evaluate(
      `document.querySelector(${JSON.stringify(rootSelector)})?.contains(document.activeElement) === true`,
    )
    for (
      let guardAttempt = 0;
      !reverseContained && guardAttempt < 6;
      guardAttempt += 1
    ) {
      const onSentinel = await evaluate(
        "document.activeElement === document.body || document.activeElement?.hasAttribute('data-base-ui-focus-guard') === true",
      )
      if (!onSentinel) break
      await pressChord('\uE008', '\uE004')
      await sleep(25)
      reverseContained = await evaluate(
        `document.querySelector(${JSON.stringify(rootSelector)})?.contains(document.activeElement) === true`,
      )
    }
    assert.equal(
      reverseContained,
      true,
      `${name} must contain reverse Tab focus`,
    )
    await pressKey('\uE00C')
    await waitForPage(
      `!document.querySelector(${JSON.stringify(rootSelector)})`,
      `${name} close on Escape`,
    )
    assert.equal(
      await evaluate(
        `document.activeElement?.textContent.trim() === ${JSON.stringify(triggerDescription)}`,
      ),
      true,
      `${name} must return focus to its trigger`,
    )
    assert.equal(
      await evaluate(
        "document.querySelector('[data-slot=sidebar-wrapper]')?.inert === false",
      ),
      true,
      `${name} must restore background keyboard access`,
    )
  }

  async function assertReducedMotion() {
    const evidence = await evaluateJson(`(() => {
      const parseDurations = value => value.split(',').map(entry => {
        const trimmed = entry.trim()
        if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed)
        if (trimmed.endsWith('s')) return Number.parseFloat(trimmed) * 1000
        return 0
      })
      const offenders = Array.from(document.querySelectorAll('body *')).map(node => {
        const style = getComputedStyle(node)
        const maximum = Math.max(...parseDurations(style.animationDuration), ...parseDurations(style.transitionDuration))
        return maximum > 0.1 ? { maximum, html: node.outerHTML.slice(0, 180) } : null
      }).filter(Boolean).slice(0, 20)
      return {
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        offenders,
        runningAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length,
      }
    })()`)
    assert.equal(evidence.reduced, true)
    assert.deepEqual(evidence.offenders, [])
    assert.equal(evidence.runningAnimations, 0)
  }

  async function assertReflow(label) {
    const evidence = await evaluateJson(`(() => {
      const horizontallyBounded = rect => rect.left >= -1 && rect.right <= innerWidth + 1
      const visible = node => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight
      }
      const offenders = Array.from(document.querySelectorAll('body *')).filter(visible).map(node => {
        const rect = node.getBoundingClientRect()
        if (horizontallyBounded(rect)) return null
        const closedSidebar = node.closest('[data-slot=sidebar][data-state=collapsed][data-collapsible=offcanvas]')
        let scroller = node.parentElement
        while (scroller && !['auto', 'scroll'].includes(getComputedStyle(scroller).overflowX)) scroller = scroller.parentElement
        const allowed = Boolean(closedSidebar || (scroller && horizontallyBounded(scroller.getBoundingClientRect())))
        return allowed ? null : { left: rect.left, right: rect.right, html: node.outerHTML.slice(0, 200) }
      }).filter(Boolean).slice(0, 20)
      const fixedActions = Array.from(document.querySelectorAll('button, a[href], input, select, textarea')).filter(node => visible(node) && ['fixed', 'sticky'].includes(getComputedStyle(node).position)).map(node => {
        const rect = node.getBoundingClientRect()
        return { bounded: horizontallyBounded(rect), html: node.outerHTML.slice(0, 180) }
      })
      return {
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        offenders,
        fixedActions,
      }
    })()`)
    assert.ok(
      evidence.scrollWidth <= evidence.innerWidth + 1 &&
        evidence.bodyWidth <= evidence.innerWidth + 1,
      `${label} document overflow: ${JSON.stringify(evidence)}`,
    )
    assert.deepEqual(evidence.offenders, [], `${label} visible overflow`)
    assert.ok(
      evidence.fixedActions.every((entry) => entry.bounded),
      `${label} fixed actions overflow: ${JSON.stringify(evidence.fixedActions)}`,
    )
    console.log(`[gap11-reflow] ${JSON.stringify({ label, ...evidence })}`)
  }

  async function zoomToTwoHundredPercent() {
    const baseline = await evaluateJson(
      `({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })`,
    )
    const zoomViewport = {
      width: Math.floor(baseline.width / 2),
      height: Math.floor(baseline.height / 2),
    }
    await bidi.command('browsingContext.setViewport', {
      context,
      viewport: zoomViewport,
      devicePixelRatio: baseline.dpr * 2,
    })
    await waitFor(
      async () => {
        const current = await evaluateJson(
          `({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })`,
        )
        return (
          Math.abs(current.width - zoomViewport.width) <= 1 &&
          current.dpr / baseline.dpr >= 1.9
        )
      },
      'Firefox 200% zoom-equivalent viewport and pixel ratio',
      10_000,
    )
    const zoomed = await evaluateJson(
      `({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })`,
    )
    const layoutFactor = baseline.width / zoomed.width
    const pixelFactor = zoomed.dpr / baseline.dpr
    assert.ok(layoutFactor >= 1.9 && layoutFactor <= 2.1)
    assert.ok(pixelFactor >= 1.9 && pixelFactor <= 2.1)
    return { baseline, zoomed, factor: Math.min(layoutFactor, pixelFactor) }
  }

  async function resetZoom(baseline) {
    await bidi.command('browsingContext.setViewport', {
      context,
      viewport: { width: baseline.width, height: baseline.height },
      devicePixelRatio: baseline.dpr,
    })
    await waitFor(
      async () => {
        const current = await evaluateJson(
          `({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })`,
        )
        return (
          Math.abs(current.width - baseline.width) <= 1 &&
          Math.abs(current.dpr - baseline.dpr) <= 0.01
        )
      },
      'Firefox zoom reset',
      10_000,
    )
  }

  try {
    await bidi.command('session.new', {
      capabilities: { alwaysMatch: { browserName: 'firefox' } },
    })
    await bidi.command('session.subscribe', {
      events: [
        'log.entryAdded',
        'network.beforeRequestSent',
        'network.fetchError',
        'network.responseCompleted',
      ],
    })
    const tree = await bidi.command('browsingContext.getTree')
    context = tree.contexts[0].context
    await bidi.command('browsingContext.setViewport', {
      context,
      viewport: { width: 1280, height: 900 },
    })

    await navigate('/dashboard/signin')
    const signInInputs =
      await evaluateJson(`Array.from(document.querySelectorAll('form input:not([type=hidden])')).map((node, index) => ({
      index,
      type: node.type,
      name: node.labels?.[0]?.textContent.trim() || node.getAttribute('aria-label') || '',
    }))`)
    assert.ok(signInInputs.length >= 2)
    assert.ok(signInInputs.every((entry) => entry.name))
    await focusExpression(
      "document.querySelectorAll('form input:not([type=hidden])')[0]",
      'dashboard identity input',
    )
    await typeCharacters(credentials.identity)
    await pressKey('\uE004')
    assert.equal(
      await evaluate(
        "document.activeElement === document.querySelectorAll('form input:not([type=hidden])')[1]",
      ),
      true,
    )
    await typeCharacters(credentials.secret)
    const enteredCredentials = await evaluateJson(
      `Array.from(document.querySelectorAll('form input:not([type=hidden])')).map(node => node.value)`,
    )
    assert.deepEqual(enteredCredentials.slice(0, 2), [
      credentials.identity,
      credentials.secret,
    ])
    await pressKey('\uE004')
    assert.equal(
      await evaluate(
        "document.activeElement?.getAttribute('aria-label') === 'Show password'",
      ),
      true,
    )
    await pressKey('\uE004')
    assert.equal(
      await evaluate("document.activeElement?.matches('button[type=submit]')"),
      true,
    )
    await click('form button[type=submit]')
    await waitForPage("location.pathname === '/dashboard'", 'dashboard sign in')

    await assertRouteSemantics('dashboard home', 'Dashboard')
    await assertSkipLink()
    await keyboardTraverse('dashboard home')
    assert.equal(
      (await accessibilityNodes('complementary', 'AI assistant')).length,
      0,
    )

    await focusSelector('#dashboard-ai-assistant-trigger')
    await activateFocusedButton('AI assistant trigger')
    await waitForPage(
      "document.querySelector('[data-slot=sidebar][data-side=right]')?.dataset.state === 'expanded'",
      'AI assistant keyboard open',
    )
    const assistantOpenState = await evaluateJson(`(() => ({
      expanded: document.querySelector('#dashboard-ai-assistant-trigger')?.getAttribute('aria-expanded'),
      hidden: document.querySelector('#dashboard-ai-assistant')?.getAttribute('aria-hidden'),
      inert: document.querySelector('#dashboard-ai-assistant')?.inert,
    }))()`)
    assert.deepEqual(assistantOpenState, {
      expanded: 'true',
      hidden: null,
      inert: false,
    })
    assert.equal(
      (await accessibilityNodes('complementary', 'AI assistant')).length,
      1,
    )
    await pressKey('\uE004')
    assert.equal(
      await evaluate(
        "document.querySelector('#dashboard-ai-assistant')?.contains(document.activeElement) === true",
      ),
      true,
      'Tab after the assistant trigger should enter the expanded region',
    )
    await assertReducedMotion()
    await pressKey('\uE00C')
    await waitForPage(
      "document.querySelector('#dashboard-ai-assistant-trigger')?.getAttribute('aria-expanded') === 'false' && document.activeElement?.id === 'dashboard-ai-assistant-trigger'",
      'AI assistant Escape close and focus return',
    )
    assert.equal(
      (await accessibilityNodes('complementary', 'AI assistant')).length,
      0,
    )

    const listRoutes =
      await evaluateJson(`Array.from(document.querySelectorAll('a[href^="/dashboard/"]'))
      .map(node => new URL(node.href).pathname)
      .filter(route => route.split('/').filter(Boolean).length === 2 && !route.endsWith('/create'))
      .filter((route, index, routes) => routes.indexOf(route) === index)`)
    assert.ok(listRoutes.length > 0, 'Dashboard home exposed no list routes')

    let selectedRoute
    for (const listRoute of listRoutes) {
      await navigate(listRoute)
      const firstItemPath = await evaluate(`(() => {
        const link = document.querySelector('tbody a[href]')
        return link ? new URL(link.href).pathname : ''
      })()`)
      const createPath = await evaluate(`(() => {
        const link = Array.from(document.querySelectorAll('a[href]')).find(node => new URL(node.href).pathname === location.pathname + '/create')
        return link ? new URL(link.href).pathname : ''
      })()`)
      if (!firstItemPath || !createPath) continue
      await navigate(firstItemPath)
      const relationshipTrigger = await evaluate(
        `Array.from(document.querySelectorAll('button')).find(node => node.textContent.trim().startsWith('Create related '))?.textContent.trim() ?? ''`,
      )
      if (!relationshipTrigger) continue
      selectedRoute = {
        listPath: listRoute,
        itemPath: firstItemPath,
        createPath,
        relationshipTrigger,
      }
      break
    }
    assert.ok(selectedRoute, 'No populated list exposed a relationship sheet')

    await navigate(selectedRoute.listPath)
    const listLabel = await evaluate(
      "Array.from(document.querySelectorAll('h1')).find(node => !node.closest('[aria-hidden=true], [inert]'))?.textContent.trim()",
    )
    assert.ok(listLabel)
    await assertRouteSemantics('list route', listLabel)
    assert.equal((await accessibilityNodes('table', listLabel)).length, 1)
    assert.equal(
      (await accessibilityNodes('searchbox', `Search ${listLabel}`)).length,
      1,
    )
    assert.equal(
      (await accessibilityNodes('navigation', `${listLabel} pagination`))
        .length,
      1,
    )
    await keyboardTraverse('list route')

    const emptySearch = `gap11-no-result-${randomBytes(8).toString('hex')}`
    await navigate(
      `${selectedRoute.listPath}?search=${encodeURIComponent(emptySearch)}`,
    )
    await waitForPage(
      "document.body.innerText.includes('No Results Found')",
      'filtered empty state',
    )
    await assertRouteSemantics('filtered empty list', listLabel)
    assert.equal(
      (await accessibilityNodes('status', 'No Results Found')).length,
      1,
    )
    await focusExpression(
      "Array.from(document.querySelectorAll('button')).find(node => node.textContent.trim() === 'Reset Filters')",
      'Reset Filters',
    )
    await activateFocusedButton('Reset Filters')
    await waitForPage(
      "Boolean(document.querySelector('table')) && document.querySelector('input[type=search]')?.value === '' && !document.body.innerText.includes('No Results Found')",
      'keyboard filter reset',
    )

    await navigate(selectedRoute.createPath)
    const createTitle = await evaluate(
      "Array.from(document.querySelectorAll('h1')).find(node => !node.closest('[aria-hidden=true], [inert]'))?.textContent.trim()",
    )
    assert.ok(createTitle)
    await assertRouteSemantics('create route')
    await keyboardTraverse('create route')

    const zoomEvidence = await zoomToTwoHundredPercent()
    await assertReflow('create route at 200% browser zoom')
    await keyboardTraverse('create route at 200% browser zoom')
    await resetZoom(zoomEvidence.baseline)

    intentionalNotFoundPath = `/dashboard/gap11-missing-${randomBytes(6).toString('hex')}`
    await navigate(intentionalNotFoundPath)
    await waitForPage(
      "Array.from(document.querySelectorAll('h1')).find(node => !node.closest('[aria-hidden=true], [inert]'))?.textContent.trim() === 'Model not found'",
      'model not-found route',
    )
    await assertRouteSemantics('not-found route', 'Model not found')
    assert.equal(
      (await accessibilityNodes('heading', 'Model not found')).length,
      1,
    )
    await keyboardTraverse('not-found route')
    await focusExpression(
      "Array.from(document.querySelectorAll('a')).find(node => node.textContent.trim() === 'Back to dashboard')",
      'Back to dashboard',
    )
    await pressKey('\uE007')
    await waitForPage(
      "location.pathname === '/dashboard'",
      'not-found recovery',
    )

    await navigate(selectedRoute.itemPath)
    await assertRouteSemantics('item route')
    await keyboardTraverse('item route')

    await focusExpression(
      `Array.from(document.querySelectorAll('button')).find(node => node.textContent.trim() === ${JSON.stringify(selectedRoute.relationshipTrigger)})`,
      selectedRoute.relationshipTrigger,
    )
    await activateFocusedButton('relationship create trigger')
    const relationshipDialogName = selectedRoute.relationshipTrigger
    await waitForPage(
      "Boolean(document.querySelector('[role=dialog]'))",
      'relationship create dialog',
    )
    await assertModalKeyboard(
      'dialog',
      relationshipDialogName,
      selectedRoute.relationshipTrigger,
    )

    await focusExpression(
      "Array.from(document.querySelectorAll('button')).find(node => node.textContent.trim() === 'Delete')",
      'item delete action',
    )
    await activateFocusedButton('item delete action')
    const alertName = await evaluate(
      "document.querySelector('[role=alertdialog] [data-slot=alert-dialog-title], [role=alertdialog] h2')?.textContent.trim() || document.querySelector('[role=alertdialog]')?.getAttribute('aria-label') || ''",
    )
    const fallbackAlertName = await evaluate(
      "document.querySelector('[role=alertdialog]')?.getAttribute('aria-labelledby') ? document.getElementById(document.querySelector('[role=alertdialog]').getAttribute('aria-labelledby'))?.textContent.trim() : ''",
    )
    const resolvedAlertName = alertName || fallbackAlertName
    assert.ok(resolvedAlertName, 'Delete alert dialog has no accessible title')
    await assertModalKeyboard('alertdialog', resolvedAlertName, 'Delete', {
      fullCycle: false,
    })

    await waitFor(
      () => evaluate("matchMedia('(forced-colors: active)').matches"),
      'Firefox forced-colors profile',
      10_000,
    )
    await focusSelector('#dashboard-ai-assistant-trigger')
    const contrastEvidence = await evaluateJson(`(() => {
      const trigger = document.querySelector('#dashboard-ai-assistant-trigger')
      const style = getComputedStyle(trigger)
      return {
        forcedColors: matchMedia('(forced-colors: active)').matches,
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        backgroundImage: style.backgroundImage,
        borderStyle: style.borderStyle,
      }
    })()`)
    assert.equal(contrastEvidence.forcedColors, true)
    assert.equal(contrastEvidence.outlineStyle, 'solid')
    assert.ok(contrastEvidence.outlineWidth >= 3)
    assert.equal(contrastEvidence.backgroundImage, 'none')
    assert.notEqual(contrastEvidence.borderStyle, 'none')
    await assertReflow('item route in forced-colors mode')

    const failures = bidi.events.filter(
      (event) => event.method === 'network.fetchError',
    )
    const unexpectedFailures = failures.filter(
      (event) => event.params.errorText !== 'NS_BINDING_ABORTED',
    )
    const badResponses = bidi.events.filter((event) => {
      if (
        event.method !== 'network.responseCompleted' ||
        event.params.response.status < 400
      )
        return false
      try {
        const pathname = new URL(event.params.response.url).pathname
        return !(
          event.params.response.status === 404 &&
          pathname === intentionalNotFoundPath
        )
      } catch {
        return true
      }
    })
    const consoleErrors = bidi.events.filter(
      (event) =>
        event.method === 'log.entryAdded' &&
        ['error', 'assert'].includes(event.params.level),
    )
    assert.deepEqual(unexpectedFailures, [])
    assert.deepEqual(badResponses, [])
    assert.deepEqual(consoleErrors, [])

    console.log(
      `GAP-11 Firefox accessibility acceptance passed: accessibility locators and unique landmarks; complete Tab-order traversal on home/list/create/item/not-found plus a 200% zoom-equivalent viewport/DPR; filtered-empty and 404 route states; assistant and relationship/delete focus containment/return; reduced motion and forced colors; ${bidi.events.length} observed events, ${failures.length} expected navigation abort(s), 0 unexpected request/response/console errors.`,
    )
    await bidi.command('session.end')
  } finally {
    bidi.close()
  }
}

await access(firefoxBinary)
const credentials = readSeededCredentials(await readFile('cms.seed.ts', 'utf8'))
const buildResult = await runBoundedChild('npm', ['run', 'build'], {
  label: 'current-source GAP-11 production build',
  timeout: 240_000,
  termGrace: 1_000,
  captureOutput: true,
  maxCapturedBytes: 8 * 1024 * 1024,
})
if (buildResult.stderr) process.stderr.write(buildResult.stderr)
await access(serverEntry)

const outputFiles = await readdir(path.resolve('.output/server'), {
  recursive: true,
})
for (const relativePath of outputFiles.filter((entry) =>
  entry.endsWith('.mjs'),
)) {
  const output = await readFile(
    path.resolve('.output/server', relativePath),
    'utf8',
  )
  assert.doesNotMatch(
    output,
    /PARITY_TEST_GENUINE_SERVER_ERROR|CMS_PARITY_FAULT_INJECTION/,
    'GAP-11 must run ordinary production output',
  )
}

const profileDirectory = await mkdtemp(
  path.join(os.tmpdir(), 'tks-gap11-firefox-'),
)
await writeFile(
  path.join(profileDirectory, 'user.js'),
  [
    'user_pref("ui.prefersReducedMotion", 1);',
    'user_pref("browser.display.document_color_use", 2);',
    'user_pref("browser.display.use_system_colors", true);',
    '',
  ].join('\n'),
)

try {
  const appPort = await availablePort()
  const bidiPort = await availablePort()
  const app = start(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      CMS_ADAPTER: 'memory',
      CMS_BOOTSTRAP_MODE: 'seeded',
      SESSION_SECRET: randomBytes(32).toString('hex'),
      HOST: '127.0.0.1',
      PORT: String(appPort),
    },
  })
  app.stdout.on('data', (chunk) => {
    appLog += chunk
  })
  app.stderr.on('data', (chunk) => {
    appLog += chunk
  })

  await waitFor(async () => {
    if (app.exitCode !== null) throw new Error(`App exited early: ${appLog}`)
    try {
      const response = await fetch(
        `http://127.0.0.1:${appPort}/dashboard/signin`,
        { signal: AbortSignal.timeout(1_000) },
      )
      await response.arrayBuffer()
      return response.ok
    } catch {
      return false
    }
  }, 'GAP-11 bounded production app')

  const firefox = start(firefoxBinary, [
    '--headless',
    '--foreground',
    '--no-remote',
    '--profile',
    profileDirectory,
    '--remote-debugging-port',
    String(bidiPort),
    'about:blank',
  ])
  firefox.stdout.on('data', (chunk) => {
    firefoxLog += chunk
  })
  firefox.stderr.on('data', (chunk) => {
    firefoxLog += chunk
  })
  await waitFor(() => {
    if (firefox.exitCode !== null)
      throw new Error(`Firefox exited early: ${firefoxLog}`)
    return firefoxLog.includes('WebDriver BiDi listening')
  }, 'GAP-11 Firefox WebDriver BiDi endpoint')

  await runBrowserFlow(
    `ws://127.0.0.1:${bidiPort}`,
    `http://127.0.0.1:${appPort}`,
    credentials,
  )

  assert.doesNotMatch(appLog, /(?:error|exception|unhandled)/i)
} catch (error) {
  console.error('\n--- GAP-11 app log ---\n', appLog)
  console.error('\n--- GAP-11 Firefox log ---\n', firefoxLog)
  throw error
} finally {
  const processCleanupResults = await Promise.allSettled([
    stopProcesses(),
    terminateProfileBoundProcesses(profileDirectory),
  ])
  const profileRemovalResults = await Promise.allSettled([
    rm(profileDirectory, { recursive: true, force: true }),
  ])
  await sleep(150)
  const cleanupVerificationResults = await Promise.allSettled([
    (async () => {
      assert.deepEqual(await profileBoundProcesses(profileDirectory), [])
    })(),
    access(profileDirectory).then(
      () => {
        throw new Error('GAP-11 Firefox profile was recreated after cleanup')
      },
      (error) => {
        if (error?.code !== 'ENOENT') throw error
      },
    ),
  ])
  const cleanupErrors = [
    ...processCleanupResults,
    ...profileRemovalResults,
    ...cleanupVerificationResults,
  ]
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason)
  if (cleanupErrors.length > 0)
    throw new AggregateError(cleanupErrors, 'GAP-11 browser cleanup failed')
}
