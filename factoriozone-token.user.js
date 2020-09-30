// ==UserScript==
// @name         Factorio Zone Token
// @version      0.3
// @description  Set user token on factorio.zone
// @author       Rubydesic
// @match        https://factorio.zone/
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@10
// @downloadURL  https://raw.githubusercontent.com/Rubydesic/factorio-zone-change-token/master/factoriozone-token.user.js
// ==/UserScript==

(function () {
    const node = document.createElement("style")
    node.innerText = `
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
    `;
    document.head.appendChild(node)

    const USER_TOKEN_KEY = "userToken"
    const TOKEN_HISTORY_KEY = "_rubydesicTokenHistory"

    const header = document.querySelector("section.info")
    const currentToken = localStorage.getItem(USER_TOKEN_KEY)
    header.innerHTML += `
        <div class="token-control flex-row">
            <button class="pure-button" id="changeToken">Change Token</button>
            <button class="pure-button" id="tokenHistory">Token History</button>
            ${currentToken ? `<p>Your token is <strong id="currentToken">${currentToken}</strong></p>` : ""}
        </div>
    `;


    document.getElementById("tokenHistory").onclick = async () => {
        const history = JSON.parse(localStorage.getItem(TOKEN_HISTORY_KEY));

        if (history === null) {
            await Swal.fire({ title: "No history!" })
        } else {
            const tableRows = history
                .map(e => `
                    <tr>
                        <td>${new Date(e.dateInvalidated).toLocaleString()}</td>
                        <td>${e.token}</td>
                    </tr>
                `)
                .join("");

            await Swal.fire({
                titleText: "Token History",
                width: "38rem",
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

    document.getElementById("changeToken").onclick = async () => {
        const originalToken = localStorage.getItem(USER_TOKEN_KEY)
        const newToken = (await Swal.fire({
            input: "text",
            inputValue: originalToken,
            title: "Set Token",
            text: "Type reset for a new token"
        })).value

        if (newToken === null) return

        if (newToken.toLowerCase() === "reset") {
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
