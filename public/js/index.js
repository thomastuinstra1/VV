// Functie voor zoeken
function searchTools() {
    // Haal de waarde uit het input veld
    const input = document.getElementById("searchInput").value.trim().toLowerCase();

    if (input === "") {
        alert("Vul een zoekterm in!");
        return;
    }

    // Voor nu: log de zoekterm in console en toon alert
    console.log("Zoekterm:", input);
    alert("Je zocht naar: " + input);

    // Hier kun je later een fetch request toevoegen naar je Node.js backend
    // bv. fetch(`/api/search?query=${encodeURIComponent(input)}`)
}

// Zorg dat Enter ook de zoekfunctie activeert
const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
        searchTools();
    }
});