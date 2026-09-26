// ==UserScript==
// @name         Factorio Zone Token
// @version      0.6.0
// @description  Manage tokens and save names on Factorio Zone
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
    const HISTORY = '_rubydesicTokenHistory'
    const NAMES = '_rubydesicSaveNames'
    const COLLAPSE = '_rubydesicCollapseHistory-'

    function read(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key))
            return value ?? fallback
        } catch {
            return fallback
        }
    }
    function names() {
        const value = read(NAMES, {})
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    }
    function history() {
        const value = read(HISTORY, [])
        return Array.isArray(value) ? value.filter(entry => entry &&
            typeof entry.token === 'string' && entry.token.trim()) : []
    }
    function element(tag, text, className) {
        const node = document.createElement(tag)
        if (text !== undefined) node.textContent = text
        if (className) node.className = className
        return node
    }
    function button(text, action, className = 'pure-button') {
        const node = element('button', text, className)
        node.type = 'button'
        node.addEventListener('click', action)
        return node
    }
    function waitFor(selector) {
        return new Promise(resolve => {
            const existing = document.querySelector(selector)
            if (existing) return resolve(existing)
            const observer = new MutationObserver(() => {
                const node = document.querySelector(selector)
                if (node) {
                    observer.disconnect()
                    resolve(node)
                }
            })
            observer.observe(document, {childList: true, subtree: true})
        })
    }

    // A native dialog supplies focus containment, Escape, and modal semantics.
    function dialog(title, description) {
        const previousFocus = document.activeElement
        const node = element('dialog', undefined, 'fzt-dialog')
        const heading = element('h2', title)
        heading.id = 'fzt-dialog-title'
        const help = element('p', description, 'fzt-help')
        help.id = 'fzt-dialog-help'
        node.setAttribute('aria-labelledby', heading.id)
        node.setAttribute('aria-describedby', help.id)
        const form = element('form')
        const content = element('div')
        const error = element('p', '', 'fzt-error')
        error.setAttribute('role', 'alert')
        const actions = element('div', undefined, 'fzt-actions')
        const close = () => node.close()
        const cancel = button('Cancel', close)
        actions.append(cancel)
        form.append(heading, help, content, error, actions)
        node.append(form)
        form.addEventListener('submit', event => event.preventDefault())
        node.addEventListener('close', () => {
            node.remove()
            if (previousFocus && previousFocus.isConnected) previousFocus.focus()
        }, {once: true})
        document.body.append(node)
        return {node, form, content, actions, cancel, close,
            show: () => node.showModal(),
            fail: message => {error.textContent = message}}
    }
    function inputField(modal, label, value) {
        const id = 'fzt-dialog-input'
        const caption = element('label', label)
        caption.htmlFor = id
        const input = element('input')
        input.id = id
        input.type = 'text'
        input.value = value || ''
        input.autocomplete = 'off'
        input.spellcheck = false
        input.autofocus = true
        modal.content.append(caption, input)
        return input
    }
    function submitButton(modal, text, action) {
        const save = element('button', text, 'pure-button pure-button-primary')
        save.type = 'submit'
        modal.actions.append(save)
        modal.form.addEventListener('submit', event => {
            event.preventDefault()
            try { action() } catch {
                modal.fail('Could not save your changes. Check that browser storage is enabled and try again.')
            }
        })
    }
    function changeToken(next) {
        const original = localStorage.getItem(TOKEN)
        if (next === original) return
        if (original && original.trim()) {
            const entries = history()
            entries.unshift({token: original, dateInvalidated: new Date().toISOString()})
            localStorage.setItem(HISTORY, JSON.stringify(entries))
        }
        if (next === null) localStorage.removeItem(TOKEN)
        else localStorage.setItem(TOKEN, next)
        location.reload()
    }
    function editToken(initial = '') {
        const modal = dialog('Change token',
            'Paste a token to return to another server. Your current token will be kept in history on this browser. The page will reload.')
        const input = inputField(modal, 'Server token', initial)
        submitButton(modal, 'Use token', () => {
            const value = input.value.trim()
            if (!value) {
                modal.fail('Enter a token, or choose Cancel to keep your current server.')
                input.focus()
                return
            }
            if (value.toLowerCase() === 'reset') {
                modal.fail('To create a new token, use New token in the toolbar.')
                return
            }
            changeToken(value)
            modal.close()
        })
        modal.show()
    }
    function resetToken() {
        const modal = dialog('Create a new token?',
            'This switches to a fresh server identity and reloads the page. Your current token will remain in history so you can return. Existing saves are not deleted.')
        submitButton(modal, 'Create new token', () => {changeToken(null); modal.close()})
        modal.show()
    }
    function showHistory() {
        const modal = dialog('Token history',
            'Previous server tokens saved in this browser. Tokens provide access to your servers; keep them private.')
        modal.cancel.textContent = 'Close'
        const entries = history()
        if (!entries.length) modal.content.append(element('p', 'No previous tokens yet. Switching or creating a token will save your current one here.'))
        else {
            const list = element('div', undefined, 'fzt-history')
            for (const entry of entries) {
                const row = element('div', undefined, 'fzt-history-row')
                const details = element('div')
                const date = new Date(entry.dateInvalidated)
                details.append(element('span', Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(), 'fzt-help'))
                const code = element('code', 'Token hidden')
                const reveal = button('Show', () => {
                    const hidden = reveal.getAttribute('aria-expanded') !== 'true'
                    reveal.setAttribute('aria-expanded', String(hidden))
                    reveal.textContent = hidden ? 'Hide' : 'Show'
                    code.textContent = hidden ? entry.token : 'Token hidden'
                })
                reveal.setAttribute('aria-expanded', 'false')
                details.append(code)
                row.append(details, reveal, button('Use token', () => {modal.close(); editToken(entry.token)}))
                list.append(row)
            }
            modal.content.append(list)
        }
        modal.show()
    }

    async function initializeSaves() {
        const saves = await waitFor('#saves')
        function updateOptions() {
            const saved = names()
            for (const option of saves.options) {
                const name = saved[option.value]
                if (typeof name !== 'string' || !name) continue
                const text = option.textContent.replace(/.+(?= \(.+\))/, () => name)
                // MutationObserver callbacks are asynchronous; avoid writing identical text.
                if (option.textContent !== text) option.textContent = text
            }
        }
        updateOptions()
        new MutationObserver(updateOptions).observe(saves, {childList: true, subtree: true, characterData: true})
        const rename = button('[rename]', () => {
            const current = saves.options[saves.selectedIndex]
            if (!current) return
            const modal = dialog('Rename save slot', 'Give this slot a name on this browser. Leave the name empty to restore its original label.')
            const input = inputField(modal, 'Slot name', names()[current.value])
            submitButton(modal, 'Save name', () => {
                const value = input.value.trim()
                if (/[()]/.test(value)) {
                    modal.fail('Use a name without parentheses; those show the save status.')
                    input.focus()
                    return
                }
                const saved = names()
                if (value) saved[current.value] = value
                else delete saved[current.value]
                localStorage.setItem(NAMES, JSON.stringify(saved))
                if (!value) location.reload()
                else updateOptions()
                modal.close()
            })
            modal.show()
        }, 'fzt-link')
        rename.id = 'fzt-rename'
        const upload = await waitFor('#upload-link')
        upload.parentElement.append(rename)
    }

    async function initialize() {
        const controls = await waitFor('section.control-container')
        if (document.getElementById('fzt-toolbar')) return
        const css = `
            #fzt-toolbar {display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;background:#e7e7e7;border-bottom:1px solid #bbb;font:inherit;color:#222}
            #fzt-toolbar .fzt-label {font-weight:bold;margin-right:4px}
            #fzt-toolbar code {overflow-wrap:anywhere;max-width:100%}
            #fzt-toolbar .fzt-status {font-size:12px;color:#555}
            .fzt-link {border:0;padding:0 0 0 6px;background:none;color:#00e;cursor:pointer;font:inherit;font-size:12px}
            .fzt-link:hover {text-decoration:underline}
            .fzt-dialog {box-sizing:border-box;width:min(560px,calc(100% - 32px));max-height:85vh;overflow:auto;border:1px solid #999;border-radius:4px;padding:20px;background:#fff;color:#222;font:14px Arial,sans-serif;box-shadow:0 8px 32px #0004}
            .fzt-dialog::backdrop {background:#0006}
            .fzt-dialog h2 {font-size:20px;margin:0 0 12px}
            .fzt-help {color:#555;line-height:1.5;margin:0 0 16px}
            .fzt-dialog label {display:block;font-weight:bold;margin-bottom:6px}
            .fzt-dialog input {box-sizing:border-box;width:100%;padding:9px;border:1px solid #999;border-radius:2px;font:inherit}
            .fzt-actions {display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:20px}
            .fzt-error {color:#a31818;line-height:1.4}
            .fzt-error:empty {display:none}
            .fzt-history-row {display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid #ddd}
            .fzt-history-row>div {flex:1;min-width:0}
            .fzt-history-row code,.fzt-history-row span {display:block;overflow-wrap:anywhere}
            .fzt-history-row span {font-size:12px;margin-bottom:4px}
            #fzt-toolbar button:focus-visible,.fzt-dialog button:focus-visible,.fzt-link:focus-visible {outline:2px solid #0078e7;outline-offset:2px}
            @media(max-width:480px) {.fzt-history-row {flex-wrap:wrap}.fzt-history-row>div {flex-basis:100%}}
        `
        // Constructed stylesheets do not require an inline <style> element.
        // Keep the site's CSP intact; never alter its policy or add remote CSS.
        if (typeof CSSStyleSheet.prototype.replaceSync === 'function') {
            const sheet = new CSSStyleSheet()
            sheet.replaceSync(css)
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
        } else {
            const style = element('style', css)
            document.head.append(style)
        }
        const toolbar = element('div')
        toolbar.id = 'fzt-toolbar'
        toolbar.setAttribute('role', 'region')
        toolbar.setAttribute('aria-label', 'Server token controls')
        toolbar.append(element('span', 'Server token', 'fzt-label'))
        const code = element('code', 'Hidden')
        code.hidden = true
        const show = button('Show token', () => {
            code.hidden = !code.hidden
            code.textContent = code.hidden ? '' : (localStorage.getItem(TOKEN) || 'No token yet')
            show.textContent = code.hidden ? 'Show token' : 'Hide token'
            show.setAttribute('aria-expanded', String(!code.hidden))
        })
        show.setAttribute('aria-expanded', 'false')
        const copy = button('Copy token', async () => {
            try {
                const value = localStorage.getItem(TOKEN)
                if (!value) {status.textContent = 'No token yet. Wait for the site to connect.'; return}
                await navigator.clipboard.writeText(value)
                status.textContent = 'Token copied.'
            } catch {status.textContent = 'Copy unavailable. Choose Show token to copy it manually.'}
        })
        const change = button('Change token', () => editToken())
        change.id = 'changeToken'
        const past = button('History', showHistory)
        past.id = 'tokenHistory'
        const status = element('span', '', 'fzt-status')
        status.setAttribute('role', 'status')
        toolbar.append(show, copy, change, past, button('New token', resetToken), code, status)
        const info = document.querySelector('section.info')
        if (info) {
            info.hidden = localStorage.getItem(COLLAPSE + 'info') === 'hidden'
            const toggle = button(info.hidden ? 'Show help' : 'Hide help', () => {
                info.hidden = !info.hidden
                toggle.textContent = info.hidden ? 'Show help' : 'Hide help'
                toggle.setAttribute('aria-expanded', String(!info.hidden))
                try {localStorage.setItem(COLLAPSE + 'info', info.hidden ? 'hidden' : 'visible')} catch {}
            })
            toggle.setAttribute('aria-expanded', String(!info.hidden))
            toolbar.append(toggle)
        }
        controls.before(toolbar)
        initializeSaves().catch(error => console.error('Factorio Zone Token: save controls failed', error))
    }
    initialize().catch(error => console.error('Factorio Zone Token failed', error))
})()
