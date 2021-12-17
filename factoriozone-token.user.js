// ==UserScript==
// @name         Factorio Zone Token
// @version      0.5.0
// @description  Set user token on factorio.zone
// @author       Rubydesic
// @match        https://factorio.zone/
// @match        https://valheim.zone/
// @match        https://satisfactory.zone/
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@10
// @downloadURL  https://raw.githubusercontent.com/Rubydesic/factorio-zone-change-token/master/factoriozone-token.user.js
// ==/UserScript==

(function () {
    const USER_TOKEN_KEY = 'userToken'
    const TOKEN_HISTORY_KEY = '_rubydesicTokenHistory'
    const COLLAPSE_HISTORY_KEY = '_rubydesicCollapseHistory-'
    const SLOT_NAMES_KEY = '_rubydesicSaveNames'

    function setLS(key, value) {
        localStorage.setItem(SLOT_NAMES_KEY, JSON.stringify(value))
    }

    function getLS(key) {
        return JSON.parse(localStorage.getItem(SLOT_NAMES_KEY) ?? 'null')
    }

    function makeCollapseButton(el, desc, id) {
        const button = document.createElement('button')
        button.classList.add('collapse-control', 'pure-button')
        if (localStorage.getItem(COLLAPSE_HISTORY_KEY + id) === 'hidden') {
            el.classList.add('hidden')
            el.classList.remove('active')
            button.innerText = 'Show' + desc
        } else {
            el.classList.add('active')
            el.classList.remove('hidden')
            button.innerText = 'Hide' + desc
        }
        button.addEventListener('click', () => {
            const cl = el.classList
            if (cl.contains('hidden')) {
                cl.add('active')
                cl.remove('hidden')
                button.innerText = 'Hide' + desc
                localStorage.setItem(COLLAPSE_HISTORY_KEY + id, 'visible')
            } else {
                cl.add('hidden')
                cl.remove('active')
                button.innerText = 'Show' + desc
                localStorage.setItem(COLLAPSE_HISTORY_KEY + id, 'hidden')
            }
        })
        el.classList.add('collapse')
        return button
    }

    const node = document.createElement('style')
    node.innerHTML = `
        #tokenHistoryTable {
            width: 100%;
        }
        #tokenHistoryTable td {
            padding: 0.2em;
        }
        .token-control {
            display: flex;
            flex-wrap: wrap;
            background: #c8c8c8;
            align-items: center;
            padding: 12px;
        }
        .token-control > * {
            margin: 6px;
        }
        section.output-container {
            min-height: 20em;
        }
        .collapse-control {
            margin: 6px;
        }
        .collapse.hidden {
            display: none;
        }
        .collapse.visible {
            display: block;
        }
        #saves {
            width: 100% !important;
            min-width: 160px;
        }
        .control-link {
            padding: 0;
        }
        .control-link a {
            padding-left: 2px;
            padding-right: 2px;
        }
    `
    document.head.appendChild(node)

    const currentToken = localStorage.getItem(USER_TOKEN_KEY)
    const controlContainer = document.querySelector('section.control-container')
    controlContainer.insertAdjacentHTML('beforebegin', `
        <div class="token-control flex-row">
            <button class="pure-button" id="changeToken">Change Token</button>
            <button class="pure-button" id="tokenHistory">Token History</button>
            ${currentToken ? `<p>Your token is <strong id="currentToken">${currentToken}</strong></p>` : ''}
        </div>
    `)

    const infoCollapse = makeCollapseButton(document.querySelector('section.info'), ' Info', 'info')
    document.querySelector('.token-control').insertAdjacentElement('afterbegin', infoCollapse)
    const tokenCollapse = makeCollapseButton(document.querySelector('.token-control > p'), '', 'token')
    document.querySelector('.token-control').insertAdjacentElement('beforeend', tokenCollapse)

    const saves = document.getElementById('saves')

    function updateOption(option) {
        const saveNames = getLS(SLOT_NAMES_KEY) ?? {}
        const name = saveNames[option.value]
        if (name) {
            option.innerText = option.innerText.replace(/.+(?= \(.+\))/, name)
        }
    }

    let updating = false
    new MutationObserver(() => {
        if (updating)
            return
        updating = true
        for (const option of saves.options) {
            updateOption(option)
        }
        updating = false
    }).observe(saves, { childList: true })


    const rename = document.createElement('a')
    rename.innerText = '[rename]'
    rename.setAttribute('href', 'javascript:void(0)')
    rename.addEventListener('click', async () => {
        const current = saves.options[saves.selectedIndex]
        const saveNames = getLS(SLOT_NAMES_KEY) ?? {}
        /** @type {string} */
        const result = (await Swal.fire({
            input: 'text',
            inputValue: saveNames[current.value] ?? '',
            title: 'Set ' + current.value + ' name',
            text: 'Type reset to go back to original'
        })).value

        if (result === '' || result.includes('(') || result.includes(')')) {
            return
        }

        if (result.toLowerCase() === 'reset') {
            delete saveNames[current.value]
            setLS(SLOT_NAMES_KEY, saveNames)
            location.reload()
        } else {
            saveNames[current.value] = result
            setLS(SLOT_NAMES_KEY, saveNames)
            updateOption(current)
        }
    })

    const div = document.createElement('div')
    div.classList.add('control-link')
    div.appendChild(rename)

    document.getElementById('upload-link').parentElement.parentElement.append(div)

    document.getElementById('tokenHistory').onclick = async () => {
        const history = JSON.parse(localStorage.getItem(TOKEN_HISTORY_KEY))

        if (history === null) {
            await Swal.fire({title: 'No history!'})
        } else {
            const tableRows = history
                .map(e => `
                    <tr>
                        <td>${new Date(e.dateInvalidated).toLocaleString()}</td>
                        <td>${e.token}</td>
                    </tr>
                `)
                .join('')

            await Swal.fire({
                titleText: 'Token History',
                width: '38rem',
                html: `
                    <table id="tokenHistoryTable">
                        <tr>
                            <th>Date Invalidated</th>
                            <th>Token</th>
                        </tr>
                        ${tableRows}
                    </table>
                `
            })
        }
    }

    document.getElementById('changeToken').onclick = async () => {
        const originalToken = localStorage.getItem(USER_TOKEN_KEY)
        const newToken = (await Swal.fire({
            input: 'text',
            inputValue: originalToken,
            title: 'Set Token',
            text: 'Type reset for a new token'
        })).value

        if (newToken === null) return

        if (newToken.toLowerCase() === 'reset') {
            localStorage.removeItem(USER_TOKEN_KEY)
            location.reload()
        } else if (newToken !== originalToken || originalToken === null) {
            const history = JSON.parse(localStorage.getItem(TOKEN_HISTORY_KEY)) || []
            history.unshift({
                dateInvalidated: new Date(),
                token: originalToken
            })
            localStorage.setItem(TOKEN_HISTORY_KEY, JSON.stringify(history))
            localStorage.setItem(USER_TOKEN_KEY, newToken)
            location.reload()
        }
    }
})()
