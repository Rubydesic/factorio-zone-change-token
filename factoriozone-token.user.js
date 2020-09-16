// ==UserScript==
// @name         Factorio Zone Token
// @version      0.2
// @description  Set user token on factorio.zone
// @author       Rubydesic
// @match        https://factorio.zone/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var header = document.querySelector("section.info");
    header.innerHTML += `<div class="control-item"><button class="pure-button" id="changetoken">Change Token</button></div>`;

  	document.getElementById("changetoken").onclick = function() {
        var token = prompt("What do you want to set your token to? (type reset for new token)", localStorage.getItem("userToken"));

        if (token.toLowerCase() === "reset") {
            localStorage.removeItem("userToken");
        } else if (token !== null) {
            localStorage.setItem("userToken", token);
        }
    }
})();
