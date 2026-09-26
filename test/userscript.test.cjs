const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {JSDOM, VirtualConsole} = require('jsdom')
const source = fs.readFileSync(path.join(__dirname, '../factoriozone-token.user.js'), 'utf8')
const controls = '<section class="control-container"><div><span><a id="upload-link"></a></span>' +
    '<select id="saves"><option value="slot1">slot 1 (empty)</option></select></div></section>'
const flush = () => new Promise(resolve => setImmediate(resolve))
async function setup(t, {token = 'old-token', html = controls, settings = {}} = {}) {
    const errors = []
    let reloads = 0
    const vc = new VirtualConsole()
    vc.on('jsdomError', error => {
        if (error.message.includes('navigation')) reloads++
        else errors.push(error)
    })
    vc.on('error', (...args) => errors.push(args))
    const dom = new JSDOM('<!doctype html><head></head><body>' + html + '</body>', {
        url: 'https://factorio.zone/', runScripts: 'outside-only', virtualConsole: vc
    })
    t.after(() => dom.window.close())
    const {window} = dom
    // jsdom supplies DOM/event tests, not native modal rendering or focus trapping.
    window.HTMLDialogElement.prototype.showModal = function () {this.open = true}
    window.HTMLDialogElement.prototype.close = function () {
        this.open = false
        this.dispatchEvent(new window.Event('close'))
    }
    const storage = window.localStorage
    if (token !== null) storage.setItem('userToken', token)
    for (const [key, value] of Object.entries(settings)) storage.setItem(key, value)
    window.eval(source)
    await flush()
    const document = window.document
    const click = async text => {
        const node = [...document.querySelectorAll('button')].find(x => x.textContent === text)
        assert.ok(node, 'Missing button: ' + text)
        node.click()
        await flush()
    }
    const fill = value => {document.querySelector('dialog input').value = value}
    return {window, document, storage, errors, click, fill, reloads: () => reloads}
}
for (const token of ['', null]) test('empty existing token keeps controls usable: ' + token, async t => {
    const e = await setup(t, {token})
    await e.click('History')
    assert.match(e.document.querySelector('dialog').textContent, /No previous tokens/)
    await e.click('Close')
    await e.click('Change token'); e.fill('new-token'); await e.click('Use token')
    assert.equal(e.storage.getItem('userToken'), 'new-token')
    assert.equal(e.storage.getItem('_rubydesicTokenHistory'), null)
    assert.equal(e.errors.length, 0)
})
for (const value of ['', '   ', 'old-token', 'reset']) test('invalid/unchanged token does not switch: ' + value, async t => {
    const e = await setup(t)
    await e.click('Change token'); e.fill(value); await e.click('Use token')
    assert.equal(e.storage.getItem('userToken'), 'old-token')
    assert.equal(e.storage.getItem('_rubydesicTokenHistory'), null)
    assert.equal(e.reloads(), 0)
    if (value !== 'old-token') assert.ok(e.document.querySelector('[role=alert]').textContent)
})
test('cancelled token and rename dialogs do not change storage', async t => {
    const e = await setup(t)
    await e.click('Change token'); e.fill('new'); await e.click('Cancel')
    await e.click('[rename]'); e.fill('name'); await e.click('Cancel')
    assert.equal(e.storage.getItem('userToken'), 'old-token')
    assert.equal(e.storage.getItem('_rubydesicSaveNames'), null)
})
test('switch and explicit reset retain previous identities', async t => {
    const e = await setup(t)
    await e.click('Change token'); e.fill(' new-token '); await e.click('Use token')
    assert.equal(e.storage.getItem('userToken'), 'new-token')
    await e.click('New token'); await e.click('Cancel')
    assert.equal(e.storage.getItem('userToken'), 'new-token')
    await e.click('New token'); await e.click('Create new token')
    assert.equal(e.storage.getItem('userToken'), null)
    assert.deepEqual(JSON.parse(e.storage.getItem('_rubydesicTokenHistory')).map(x => x.token), ['new-token','old-token'])
})
test('late controls initialize without optional info', async t => {
    const e = await setup(t, {html: ''})
    e.document.body.innerHTML = controls
    await flush()
    await e.click('History')
    assert.equal(e.errors.length, 0)
})
test('late saves do not delay token controls', async t => {
    const e = await setup(t, {html: '<section class="control-container"></section>'})
    await e.click('History'); await e.click('Close')
    e.document.querySelector('section').innerHTML = '<div><span><a id="upload-link"></a></span><select id="saves"><option value="slot1">slot 1 (empty)</option></select></div>'
    await flush()
    await e.click('[rename]'); e.fill('Factory'); await e.click('Save name')
    assert.equal(e.document.querySelector('option').textContent, 'Factory (empty)')
})
test('saved names apply immediately, retain literal dollar signs, and track site updates', async t => {
    const e = await setup(t, {settings: {_rubydesicSaveNames: '{"slot1":"Factory $&"}'}})
    const option = e.document.querySelector('option')
    assert.equal(option.textContent, 'Factory $& (empty)')
    option.textContent = 'slot 1 (saved)'; await flush()
    assert.equal(option.textContent, 'Factory $& (saved)')
    await e.click('[rename]'); e.fill(''); await e.click('Save name')
    assert.deepEqual(JSON.parse(e.storage.getItem('_rubydesicSaveNames')), {})
})
for (const value of ['{invalid', '42', 'null', '[]']) test('malformed stored data: ' + value, async t => {
    const e = await setup(t, {settings: {_rubydesicSaveNames:value,_rubydesicTokenHistory:value}})
    await e.click('History'); await e.click('Close')
    await e.click('Change token'); e.fill('new-token'); await e.click('Use token')
    await e.click('[rename]'); e.fill('Factory'); await e.click('Save name')
    assert.equal(e.storage.getItem('userToken'), 'new-token')
    assert.equal(JSON.parse(e.storage.getItem('_rubydesicSaveNames')).slot1, 'Factory')
    assert.equal(e.errors.length, 0)
})
test('tokens hidden by default and rendered as text when revealed', async t => {
    const token = '<img src=x onerror=alert(1)>'
    const e = await setup(t, {token,settings:{_rubydesicTokenHistory:JSON.stringify([null,{token}])}})
    assert.ok(!e.document.querySelector('#fzt-toolbar').textContent.includes(token))
    await e.click('Show token')
    assert.equal(e.document.querySelector('code').textContent, token)
    assert.equal(e.document.querySelector('img'), null)
    await e.click('History'); await e.click('Show')
    assert.equal(e.document.querySelector('dialog code').textContent, token)
    assert.equal(e.document.querySelector('dialog img'), null)
})
test('history use action fills a confirmation dialog without switching immediately', async t => {
    const e = await setup(t, {settings:{_rubydesicTokenHistory:'[{"token":"previous"}]'}})
    await e.click('History'); await e.click('Use token')
    assert.equal(e.document.querySelector('dialog input').value, 'previous')
    assert.equal(e.storage.getItem('userToken'), 'old-token')
    await e.click('Use token')
    assert.equal(e.storage.getItem('userToken'), 'previous')
})
test('storage write errors stay visible and preserve current token', async t => {
    const e = await setup(t)
    e.window.Storage.prototype.setItem = () => {throw new Error('quota')}
    await e.click('Change token'); e.fill('new-token'); await e.click('Use token')
    assert.match(e.document.querySelector('[role=alert]').textContent, /Could not save/)
    assert.equal(e.storage.getItem('userToken'), 'old-token')
    assert.equal(e.reloads(), 0)
})
test('duplicate execution creates no duplicate toolbar', async t => {
    const e = await setup(t)
    e.window.eval(source); await flush()
    assert.equal(e.document.querySelectorAll('#fzt-toolbar').length, 1)
})
