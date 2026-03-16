document.addEventListener("DOMContentLoaded", function () {

    function searchTools() {

        const input = document
            .getElementById("searchInput")
            .value
            .trim()
            .toLowerCase();

        if (input === "") {
            alert("Vul een zoekterm in!");
            return;
        }

        console.log("Zoekterm:", input);

        alert("Je zocht naar: " + input);
    }

    window.searchTools = searchTools;

    const searchInput = document.getElementById("searchInput");

    searchInput.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            searchTools();
        }
    });

});