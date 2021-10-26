// ==UserScript==
// @name         Factorio Zone Token
// @version      0.4
// @description  Set user token on factorio.zone
// @author       Rubydesic
// @match        https://factorio.zone/
// @match        https://valheim.zone/
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@10
// @downloadURL  https://raw.githubusercontent.com/Rubydesic/factorio-zone-change-token/master/factoriozone-token.user.js
// ==/UserScript==

(function () {
    const USER_TOKEN_KEY = 'userToken'
    const TOKEN_HISTORY_KEY = '_rubydesicTokenHistory'
    const COLLAPSE_HISTORY_KEY = '_rubydesicCollapseHistory-'

    function makeCollapseButton(el, desc, id) {
        const button = document.createElement('button')
        button.classList.add('collapse-control', 'pure-button')
        button.innerText = 'Hide' + desc
        if (localStorage.getItem(COLLAPSE_HISTORY_KEY + id) === 'hidden') {
            el.classList.add('hidden')
            el.classList.remove('active')
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

    document.getElementById('tokenHistory').onclick = async () => {
        const history = JSON.parse(localStorage.getItem(TOKEN_HISTORY_KEY))

        if (history === null) {
            await Swal.fire({ title: 'No history!' })
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
