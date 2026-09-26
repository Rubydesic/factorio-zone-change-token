// ==UserScript==
// @name         Factorio Zone Token
// @version      0.7.1
// @description  Save, name, and switch tokens on factorio.zone
// @author       Rubydesic
// @match        https://factorio.zone/
// @match        https://valheim.zone/
// @match        https://satisfactory.zone/
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/Rubydesic/factorio-zone-change-token/master/factoriozone-token.user.js
// ==/UserScript==

(function () {
    'use strict'
    const TOKEN = 'userToken'
    const SAVED = '_rubydesicTokens'
    const HISTORY = '_rubydesicTokenHistory'
    const PENDING = '_rubydesicPendingTokenName'
    const SAVE_NAMES = '_rubydesicSaveNames'
    let select, status, reload, active = '', externalChange = false

    function read(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
        catch { return fallback }
    }
    function current() { return localStorage.getItem(TOKEN) || '' }
    function write(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
    function node(tag, text, className) {
        const result = document.createElement(tag)
        if (text !== undefined) result.textContent = text
        if (className) result.className = className
        return result
    }
    function button(text, action, className = 'pure-button', fail = report) {
        const result = node('button', text, className)
        result.type = 'button'
        result.addEventListener('click', async () => {
            try { await action() } catch { fail('Could not save changes. Check browser storage and try again.') }
        })
        return result
    }
    function report(message) { if (status) status.textContent = message }
    function waitFor(selector) {
        return new Promise(resolve => {
            const existing = document.querySelector(selector)
            if (existing) return resolve(existing)
            const observer = new MutationObserver(() => {
                const found = document.querySelector(selector)
                if (found) { observer.disconnect(); resolve(found) }
            })
            observer.observe(document, {childList: true, subtree: true})
        })
    }
    function tokens() {
        const saved = read(SAVED, null)
        // Once a catalog exists, history is not imported again. Removed entries stay removed.
        const source = Array.isArray(saved) ? saved : read(HISTORY, [])
        const result = [], seen = new Set()
        for (const entry of Array.isArray(source) ? source : []) {
            if (!entry || typeof entry.token !== 'string' || !entry.token.trim() || seen.has(entry.token)) continue
            seen.add(entry.token)
            result.push({token: entry.token, name: typeof entry.name === 'string' ? entry.name : ''})
        }
        for (const token of [active, current()]) {
            if (token.trim() && !seen.has(token)) { result.push({token, name: ''}); seen.add(token) }
        }
        return result
    }
    function short(token) { return token.length > 20 ? token.slice(0, 8) + '…' + token.slice(-8) : token }
    function fillSelect(target, entries, selected, markCurrent = false) {
        target.replaceChildren()
        for (const entry of entries) {
            const duplicateName = entry.name && entries.some(other => other.token !== entry.token && other.name.toLowerCase() === entry.name.toLowerCase())
            const duplicateShort = entries.some(other => other.token !== entry.token && short(other.token) === short(entry.token))
            const value = duplicateShort ? entry.token : short(entry.token)
            const label = entry.name ? entry.name + (duplicateName ? ' · ' + value : '') : value
            const suffix = !markCurrent ? '' : entry.token === active ? ' (current)' : entry.token === current() ? ' (other tab)' : ''
            const option = node('option', label + suffix)
            option.value = entry.token
            option.title = entry.token
            target.append(option)
        }
        if (!entries.length || !entries.some(entry => entry.token === selected)) {
            const placeholder = node('option', 'No token yet')
            placeholder.value = ''
            placeholder.disabled = true
            target.prepend(placeholder)
        }
        target.value = entries.some(entry => entry.token === selected) ? selected : ''
    }
    function refresh() {
        const entries = tokens()
        fillSelect(select, entries, active)
        select.disabled = entries.length === 0
    }
    function rememberCurrent() {
        const entries = tokens()
        write(SAVED, entries)
        const previous = active || current()
        if (previous.trim()) {
            const old = read(HISTORY, [])
            const seen = new Set([previous])
            const history = (Array.isArray(old) ? old : []).filter(entry => {
                if (!entry || typeof entry.token !== 'string' || !entry.token.trim() || seen.has(entry.token)) return false
                seen.add(entry.token)
                return true
            })
            history.unshift({token: previous, dateInvalidated: new Date().toISOString()})
            write(HISTORY, history)
        }
        return entries
    }
    function switchTo(token, name) {
        if (!token.trim()) return
        if (token === active && token === current() && name === undefined) return
        const entries = token === active && token === current() ? tokens() : rememberCurrent()
        const existing = entries.find(entry => entry.token === token)
        if (!existing) entries.push({token, name: name || ''})
        else if (name) existing.name = name
        write(SAVED, entries)
        sessionStorage.removeItem(PENDING)
        if (token === active && token === current()) { refresh(); return }
        // Do not change identity unless saving both the old and new entries succeeded.
        localStorage.setItem(TOKEN, token)
        location.reload()
    }
    function newToken(name) {
        const entries = rememberCurrent()
        sessionStorage.setItem(PENDING, JSON.stringify({name, known: entries.map(entry => entry.token)}))
        try { localStorage.removeItem(TOKEN) }
        catch (error) { sessionStorage.removeItem(PENDING); throw error }
        location.reload()
    }
    function captureToken() {
        if (externalChange) return true
        const token = current()
        if (!token.trim()) return false
        const entries = tokens()
        let pending
        try { pending = JSON.parse(sessionStorage.getItem(PENDING)) } catch {}
        if (pending && typeof pending.name === 'string' && Array.isArray(pending.known) && !pending.known.includes(token)) {
            entries.find(entry => entry.token === token).name = pending.name
        }
        write(SAVED, entries)
        sessionStorage.removeItem(PENDING)
        active = token
        refresh()
        return true
    }
    function modal(title) {
        const open = document.getElementById('fzt-dialog')
        if (open) return null
        const previousFocus = document.activeElement
        const dialog = node('dialog')
        dialog.id = 'fzt-dialog'
        const heading = node('h3', title)
        heading.id = 'fzt-title'
        dialog.setAttribute('aria-labelledby', heading.id)
        const form = node('form')
        const body = node('div')
        const error = node('p', '', 'fzt-message')
        error.setAttribute('role', 'status')
        const actions = node('div', undefined, 'fzt-actions')
        form.append(heading, body, error, actions)
        form.addEventListener('submit', event => event.preventDefault())
        dialog.append(form)
        dialog.addEventListener('close', () => {
            dialog.remove()
            if (previousFocus && previousFocus.isConnected) previousFocus.focus()
        }, {once: true})
        document.body.append(dialog)
        return {dialog, form, body, actions, error,
            fail: message => {error.textContent = message},
            close: () => dialog.close(), show: () => dialog.showModal()}
    }
    function field(modal, label, id, tag = 'input') {
        const caption = node('label', label)
        caption.htmlFor = id
        const input = node(tag)
        input.id = id
        if (tag === 'input') { input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false }
        modal.body.append(caption, input)
        return input
    }
    function submit(modal, label, action) {
        const save = node('button', label, 'pure-button pure-button-primary')
        save.type = 'submit'
        modal.actions.append(save)
        modal.form.addEventListener('submit', () => {
            try { action() } catch { modal.fail('Could not save changes. Check browser storage and try again.') }
        })
    }
    async function copy(token, feedback, fallback) {
        if (!token) { feedback('No token yet.'); return }
        try { await navigator.clipboard.writeText(token); feedback('Copied') }
        catch { fallback() }
    }
    function copyControl(label, getToken, fallback, className = 'pure-button', fail = report) {
        let timer
        const control = button(label, () => copy(getToken(), message => {
            clearTimeout(timer)
            control.textContent = label.startsWith('[') ? '[' + message.toLowerCase() + ']' : message
            timer = setTimeout(() => { control.textContent = label }, 1600)
        }, fallback), className, fail)
        control.setAttribute('aria-live', 'polite')
        return control
    }
    function addToken() {
        const m = modal('Add token')
        if (!m) return
        const token = field(m, 'Token', 'fzt-add-token')
        token.autofocus = true
        const name = field(m, 'Name (optional)', 'fzt-add-name')
        m.body.append(button('Generate new token', () => newToken(name.value.trim()), 'fzt-link fzt-new', m.fail))
        m.actions.append(button('Cancel', m.close))
        submit(m, 'Add & switch', () => {
            if (!token.value.trim()) { m.fail('Enter a token.'); token.focus(); return }
            switchTo(token.value.trim(), name.value.trim())
            m.close()
        })
        m.show()
    }
    function manageTokens(manualCopy = false) {
        const m = modal('Manage tokens')
        if (!m) return
        const chosen = field(m, 'Token', 'fzt-manage-token', 'select')
        const name = field(m, 'Name', 'fzt-manage-name')
        const value = field(m, 'Value', 'fzt-manage-value')
        value.readOnly = true
        value.addEventListener('click', () => value.select())
        let removed
        const copyButton = copyControl('Copy', () => chosen.value, () => {
            value.focus(); value.select(); m.fail('Select and copy the token above.')
        }, 'pure-button', m.fail)
        const undo = button('Undo', () => {
            if (!removed) return
            const entries = tokens()
            if (!entries.some(entry => entry.token === removed.entry.token)) entries.splice(removed.index, 0, removed.entry)
            write(SAVED, entries)
            const restored = removed.entry.token
            removed = null
            update(restored)
            refresh()
            m.fail('Restored.')
        }, 'fzt-link', m.fail)
        undo.hidden = true
        const remove = button('Remove from list', () => {
            const entries = tokens(), index = entries.findIndex(entry => entry.token === chosen.value)
            if (index < 0 || chosen.value === active || chosen.value === current()) return
            const entry = entries[index]
            entries.splice(index, 1)
            write(SAVED, entries)
            removed = {entry, index}
            update(active)
            refresh()
            m.fail('Removed from list.')
        }, 'fzt-link', m.fail)
        const secondary = node('div', undefined, 'fzt-secondary')
        secondary.append(copyButton, remove, undo)
        m.body.append(secondary)
        function update(selected) {
            const entries = tokens()
            fillSelect(chosen, entries, selected, true)
            load()
        }
        function load() {
            const entry = tokens().find(entry => entry.token === chosen.value)
            name.value = entry ? entry.name : ''
            value.value = entry ? entry.token : ''
            name.disabled = value.disabled = copyButton.disabled = !entry
            remove.disabled = !entry || entry.token === active || entry.token === current()
            remove.hidden = remove.disabled
            remove.title = !entry ? '' : entry.token === active ? 'The current token stays in the list.' :
                entry.token === current() ? 'This token is selected in another tab.' : ''
            undo.hidden = !removed
        }
        chosen.addEventListener('change', () => {load(); m.fail('')})
        m.actions.append(button('Close', m.close))
        submit(m, 'Save name', () => {
            const entries = tokens(), entry = entries.find(entry => entry.token === chosen.value)
            if (!entry) { update(active); m.fail('This token was removed in another tab.'); return }
            entry.name = name.value.trim()
            write(SAVED, entries)
            refresh()
            update(entry.token)
            m.fail('Saved.')
        })
        update(active)
        m.show()
        if (manualCopy) { value.focus(); value.select(); m.fail('Select and copy the token above.') }
    }
    async function initializeSaves() {
        const saves = await waitFor('#saves')
        const names = () => {
            const value = read(SAVE_NAMES, {})
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
        }
        function update() {
            const saved = names()
            for (const option of saves.options) {
                const name = saved[option.value]
                if (typeof name !== 'string' || !name) continue
                const text = option.textContent.replace(/.+(?= \(.+\))/, () => name)
                if (option.textContent !== text) option.textContent = text
            }
        }
        update()
        new MutationObserver(update).observe(saves, {childList: true, subtree: true, characterData: true})
        const rename = button('[rename]', () => {
            const option = saves.options[saves.selectedIndex]
            if (!option) return
            const saved = names()
            const input = prompt('Slot name (or reset):', saved[option.value] || '')
            if (input === null || !input.trim()) return
            const name = input.trim()
            if (/[()]/.test(name)) { report('Slot names cannot contain parentheses.'); return }
            if (name.toLowerCase() === 'reset') delete saved[option.value]
            else saved[option.value] = name
            write(SAVE_NAMES, saved)
            if (name.toLowerCase() === 'reset') location.reload()
            else update()
        }, 'fzt-link')
        rename.id = 'fzt-rename'
        const upload = await waitFor('#upload-link')
        upload.parentElement.append(rename)
    }
    async function initialize() {
        const controls = await waitFor('section.control-container')
        if (document.getElementById('fzt-control')) return
        const css = `
            #fzt-control {max-width:100%;min-width:210px}
            #fzt-select {box-sizing:border-box;width:100%;max-width:300px;min-width:210px}
            .fzt-link {border:0;background:none;padding:0 0 0 6px;color:#00e;font:inherit;font-size:12px;cursor:pointer}
            .fzt-link:hover {text-decoration:underline}
            .fzt-link:disabled {color:#666;cursor:default;text-decoration:none}
            #fzt-status {font-size:12px;margin-top:4px;max-width:300px}
            #fzt-status:empty,.fzt-message:empty {display:none}
            #fzt-dialog {box-sizing:border-box;width:360px;max-width:calc(100% - 32px);max-height:85vh;overflow:auto;border:1px solid #999;border-radius:3px;padding:16px;font:14px Arial,sans-serif;background:white;color:#222}
            #fzt-dialog::backdrop {background:#0005}
            #fzt-dialog h3 {margin:0 0 14px;font-size:18px}
            #fzt-dialog label {display:block;margin:12px 0 4px}
            #fzt-dialog input,#fzt-dialog select {box-sizing:border-box;width:100%;min-width:0;padding:6px;font:inherit}
            #fzt-dialog input[readonly] {font-family:monospace}
            .fzt-actions,.fzt-secondary {display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px}
            .fzt-actions {justify-content:flex-end}
            .fzt-new {padding:0;margin-top:12px}
            .fzt-message {margin:12px 0 0;line-height:1.4}
            #fzt-control button:focus-visible,#fzt-dialog button:focus-visible {outline:2px solid #0078e7;outline-offset:2px}
        `
        // Constructed stylesheets work with the site's CSP; do not relax its policy.
        if ('adoptedStyleSheets' in document && typeof CSSStyleSheet.prototype.replaceSync === 'function') {
            const sheet = new CSSStyleSheet()
            sheet.replaceSync(css)
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
        } else document.head.append(node('style', css))
        const control = node('div', undefined, 'control-item')
        control.id = 'fzt-control'
        const header = node('div', undefined, 'control-label')
        const label = node('label', 'Token')
        label.htmlFor = 'fzt-select'
        header.append(label, button('[add]', addToken, 'fzt-link'), button('[manage]', () => manageTokens(), 'fzt-link'),
            copyControl('[copy]', () => active, () => manageTokens(true), 'fzt-link'))
        select = node('select')
        select.id = 'fzt-select'
        select.title = 'Choose a token to switch'
        select.addEventListener('change', () => {
            try { switchTo(select.value) }
            catch { refresh(); report('Could not switch. Check browser storage and try again.') }
        })
        status = node('span')
        status.id = 'fzt-status'
        status.setAttribute('role', 'status')
        reload = button('Reload', () => location.reload(), 'fzt-link')
        reload.hidden = true
        control.append(header, select, status, reload)
        controls.prepend(control)
        active = current()
        refresh()
        try { write(SAVED, tokens()) } catch { report('Could not save the token list. Check browser storage.') }
        // The website can issue the first token after its controls have rendered.
        const capture = () => {
            try { return captureToken() }
            catch { report('Could not save the token list. Check browser storage.'); return true }
        }
        if (!capture()) {
            const timer = setInterval(() => { if (capture()) clearInterval(timer) }, 500)
            window.addEventListener('pagehide', () => clearInterval(timer), {once: true})
        }
        window.addEventListener('storage', event => {
            if (event.key === TOKEN && current() !== active) {
                externalChange = true
                try { sessionStorage.removeItem(PENDING) } catch {}
                report('Token changed in another tab.')
                reload.hidden = false
            } else if (event.key === SAVED) refresh()
        })
        initializeSaves().catch(error => console.error('Factorio Zone Token: save controls failed', error))
    }
    initialize().catch(error => console.error('Factorio Zone Token failed', error))
})()
