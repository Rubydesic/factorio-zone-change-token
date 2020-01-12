// ==UserScript==
// @name         Factorio Zone Token
// @version      0.1
// @description  Set user token on factorio.zone
// @author       You
// @match        https://factorio.zone/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var header = document.querySelector("section.control-container.flex-row");
    header.innerHTML += `<div class="control-item"><button class="pure-button" onclick="promptForToken()">Change Token</button></div>`;

    window.promptForToken = function() {
        var token = prompt("What do you want to set your token to? (type reset for new token)", localStorage.getItem("userToken"));

        if (token.toLowerCase() === "reset") {
            localStorage.removeItem("userToken");
        } else if (token !== null) {
            localStorage.setItem("userToken", token);
        }
    }
})();
