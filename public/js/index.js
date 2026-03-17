document.addEventListener("DOMContentLoaded", function () {

    function searchTools() {

        const input = document
            .getElementById("searchInput")
            .value
            .trim();

        if (input === "") {
            alert("Vul een zoekterm in!");
            return;
        }

        fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(input)}`)
            .then(response => response.json())
            .then(data => {

                console.log("Resultaten:", data);

                displayResults(data);
            })
            .catch(error => {
                console.error("Fout:", error);

                document.getElementById("results").innerHTML =
                    "<p>Er ging iets mis met zoeken.</p>";
            });
    }

    window.searchTools = searchTools;

    const searchInput = document.getElementById("searchInput");

    searchInput.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            searchTools();
        }
    });

});

function displayResults(tools) {
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";

    if (tools.length === 0) {
        resultsDiv.innerHTML = "<p>Geen resultaten gevonden</p>";
        return;
    }

    tools.forEach(tool => {
        const div = document.createElement("div");

        div.innerHTML = `
            <h3>${tool.Naam}</h3>
            <p>${tool.Beschrijving || "Geen beschrijving beschikbaar"}</p>
            ${tool.Afbeelding ? `<img src="${tool.Afbeelding}" alt="${tool.Naam}" style="max-width:150px; display:block;">` : ""}
        `;

        resultsDiv.appendChild(div);
    });
}