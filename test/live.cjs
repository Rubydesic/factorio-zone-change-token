// Opt-in integration tests: contacts factorio.zone, using disposable browser contexts.
// Never starts a game server or uploads/deletes a save.
const {firefox} = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const {execFileSync} = require('node:child_process')
const path = require('node:path')
const script = fs.readFileSync(path.join(__dirname, '../factoriozone-token.user.js'), 'utf8')
const base = '318f1fe122c2e70fafe149046ad2f898218f38e1'
const original = execFileSync('git', ['show', base + ':factoriozone-token.user.js'], {encoding:'utf8'})
const artifacts = path.join(__dirname, '../test-results')
fs.mkdirSync(artifacts, {recursive:true})
const report = []
async function check(name, action) {await action(); report.push(name); console.log('PASS ' + name)}
async function ready(page) {
    await page.waitForFunction(() => document.querySelector('#saves option') && localStorage.getItem('userToken'))
}
async function run() {
    const browser = await firefox.launch()
    try {
        const baseline = await browser.newContext()
        const before = await baseline.newPage()
        await before.goto('https://factorio.zone/')
        await ready(before)
        await check('Reproduce original empty-token crash on the real site', async () => {
            const error = await before.evaluate(source => {
                localStorage.setItem('userToken', '')
                try { (0, eval)(source); return null } catch (error) {return error.message}
            }, original)
            assert.match(error, /classList/)
        })
        await before.reload()
        await before.locator('section.control-container').waitFor()
        await check('Recover an existing empty-token session using the new controls', async () => {
            // Execute as automation-provided userscript code, not a site script tag.
            // Keep the site's CSP enabled (no bypassCSP browser option).
            await before.evaluate(source => (0, eval)(source), script)
            await before.getByRole('button',{name:'New token',exact:true}).click()
            await Promise.all([before.waitForEvent('load'),before.getByRole('button',{name:'Create new token',exact:true}).click()])
            await ready(before)
        })
        await check('Reproduce original missing-control crash on real page DOM', async () => {
            const error = await before.evaluate(source => {
                const controls = document.querySelector('section.control-container')
                controls.remove()
                try {(0, eval)(source); return null} catch (error) {return error.message}
            }, original)
            assert.match(error, /insertAdjacentHTML/)
        })
        await baseline.close()

        const context = await browser.newContext({viewport:{width:1280,height:900}})
        await context.addInitScript({content:script})
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto('https://factorio.zone/')
        await ready(page)
        await page.locator('#fzt-toolbar').waitFor()
        const token = await page.evaluate(() => localStorage.getItem('userToken'))
        await check('Initialize before site rendering and keep token hidden', async () => {
            assert.equal(await page.locator('#fzt-toolbar code').isVisible(), false)
            assert.equal(await page.locator('#fzt-toolbar').count(), 1)
            assert.equal(await page.locator('#fzt-toolbar').evaluate(node => getComputedStyle(node).display), 'flex')
            assert.equal(await page.locator('#fzt-toolbar').evaluate(node => getComputedStyle(node).gap), '8px')
        })
        await check('Blank token has inline validation and Cancel leaves identity unchanged', async () => {
            await page.getByRole('button',{name:'Change token',exact:true}).click()
            await page.getByRole('button',{name:'Use token',exact:true}).click()
            assert.match(await page.locator('[role=alert]').innerText(), /Enter a token/)
            await page.getByRole('button',{name:'Cancel',exact:true}).click()
            assert.equal(await page.evaluate(()=>localStorage.getItem('userToken')), token)
            await page.getByRole('button',{name:'Change token',exact:true}).click()
            await page.keyboard.press('Escape')
            assert.equal(await page.locator('dialog').count(), 0)
        })
        await check('Save rename, cancellation, reload persistence, and reset', async () => {
            await page.getByRole('button',{name:'[rename]',exact:true}).click()
            await page.getByLabel('Slot name',{exact:true}).fill('Regression factory')
            await page.getByRole('button',{name:'Save name',exact:true}).click()
            assert.match(await page.locator('#saves option:checked').innerText(), /Regression factory/)
            await page.reload(); await ready(page)
            await page.waitForFunction(()=>document.querySelector('#saves option').textContent.includes('Regression factory'))
            await page.getByRole('button',{name:'[rename]',exact:true}).click()
            await page.getByRole('button',{name:'Cancel',exact:true}).click()
            await page.getByRole('button',{name:'[rename]',exact:true}).click()
            await page.getByLabel('Slot name',{exact:true}).fill('')
            await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Save name',exact:true}).click()])
            await ready(page)
            assert.ok(!(await page.locator('#saves option:checked').innerText()).includes('Regression factory'))
        })
        await check('Create a new disposable identity and restore original via history', async () => {
            await page.getByRole('button',{name:'New token',exact:true}).click()
            await page.getByRole('button',{name:'Cancel',exact:true}).click()
            assert.equal(await page.evaluate(()=>localStorage.getItem('userToken')),token)
            await page.getByRole('button',{name:'New token',exact:true}).click()
            await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Create new token',exact:true}).click()])
            await ready(page)
            assert.notEqual(await page.evaluate(()=>localStorage.getItem('userToken')),token)
            await page.getByRole('button',{name:'History',exact:true}).click()
            await page.getByRole('button',{name:'Use token',exact:true}).click()
            assert.equal(await page.getByLabel('Server token',{exact:true}).inputValue(),token)
            await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Use token',exact:true}).click()])
            await ready(page)
            assert.equal(await page.evaluate(()=>localStorage.getItem('userToken')),token)
        })
        await check('Desktop and mobile layout fit without horizontal scrolling', async () => {
            await page.screenshot({path:path.join(artifacts,'desktop.png'),fullPage:true})
            await page.setViewportSize({width:390,height:844})
            await page.getByRole('button',{name:'Change token',exact:true}).click()
            await page.screenshot({path:path.join(artifacts,'mobile-dialog.png'),fullPage:true})
            assert.ok(await page.locator('dialog').evaluate(node=>node.getBoundingClientRect().right <= innerWidth))
            assert.equal(await page.locator('dialog').evaluate(node=>getComputedStyle(node).padding), '20px')
            await page.keyboard.press('Escape')
        })
        assert.deepEqual(errors, [], 'Unexpected browser JavaScript errors')
        await context.close()
    } finally {
        fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify(report,null,2))
        await browser.close()
    }
}
run().catch(error=>{console.error(error);process.exitCode=1})
