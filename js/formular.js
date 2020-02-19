// airtable-Zeugs
const Airtable = require('airtable');
let base = null

// Vorgabe, welche Kategorien/Elemente es in welcher Reihenfolge gibt
// muss zum oben definierten Formular passen 
const categories = ["Fach", "Fachbereich", "Thema", "Themenbereich"
                , "Dysfunktionen", "Pathologie"];
const allData = categories.concat(["Jahrgang", "Dozent"]);
// "store"
let data = {};

// modal zeigen (Animation, Login usw.)
function show_modal(id) {
    document.getElementById(id).className = "modal is-active";
}

// modal verstecken
function hide_modal(id) {
    document.getElementById(id).className = "modal";
}

// Optionsliste zurücksetzen => alle Optionen löschen und
// leere Option wieder anlegen
function clear_select(sel) {
    while (sel && sel.firstChild) {
        sel.removeChild(sel.firstChild);
    }
    if (sel)
        sel.appendChild(document.createElement('option'));
}

// Daten aus einer gegebenen Tabelle lesen
function read(table, f) {
    base(table).select().eachPage((records, nextPage) => {
        records.forEach(rec => {
            data[table].records.push(rec);
        });
        nextPage();
    }, /* "fertig"-callback */ f);
}

// Optionsliste zu einer gegebenen Tabelle mit übergebenen Records befüllen
function populate_select(source, records) {
    clear_select(document.getElementById(source));
    records.sort((r1, r2) => r1.get("Counter") - r2.get("Counter")).forEach(record => {
        let childoption = document.createElement('option');
        childoption.appendChild(document.createTextNode(record.get(source)));
        document.getElementById(source).appendChild(childoption);
    });
}

// Initialisierung anh. der Vorgabe, welche Kategorie usw. es gibt,
// Daten in "store" einlesen und alle Optionslisten befüllen
function init(datasources) {
    hide_modal("login");
    show_modal("anime");
    let done = [];
    datasources.forEach(source => {
        data[source] = {records: []};
        read(source, (error) => {
            if (error) {
                done.push(source);
                if (done.length === datasources.length) {
                    hide_modal("anime");
                    show_modal("login");
                    console.error(error);
                    alert(error);
                }
                return;
            } else {
                done.push(source);
                if (done.length === datasources.length) {
                    done.forEach(source => {
                        populate_select(source, data[source].records);
                    });
                    hide_modal("anime");
                }
            }
        });
    });
}

function login() {
    try {
        base = new Airtable({
            // key5FhA59loaFeb2p (nur lesen)
            apiKey: document.getElementById("apiKey").value,
        }).base('app9NCIMkL8v5bQd2');
        init(allData);
    } catch (error) { 
        console.error(error);
        alert(error);
    }
}

// Falls in einem Form-Element ein Wert verändert wird
function change(e) {
    let selected = [];
    // akt. Element
    let curCategory = e.srcElement.id;
    let curValue = e.srcElement.value;
    // anh. gewähltem Wert d. akt. Elements, Record lesen
    let [curRec] = data[curCategory].records.filter(r => r.fields[curCategory] === curValue);
    
    // alle übergeordneten Elemente durchlaufen
    categories.slice(0, categories.indexOf(e.srcElement.id)).forEach(category => {
        let rec;
        // im akt. Element d. Form kann ein Record gewählt sein 
        // oder auch nicht (wenn die Auswahl gelöscht wird)
        if (curRec) {
            // aus d. Record d. akt. in der Form gewählten Elements
            // die ID des akt. übergeordneten Elements d. Iteration lesen,
            // entspr. Record lesen und darstellen
            let [id] = curRec.fields[category] ? curRec.fields[category] : [];
                [rec] = data[category].records.filter(r => r.id === id);
            document.getElementById(category).value = rec ? rec.fields[category] : "";
        } else {
            // Record des akt. übergeordneten Elements anh. des
            // gewählten Werts lesen
            let value = document.getElementById(category).value;
                [rec] = data[category].records.filter(r => r.fields[category] === value);
        }

        // Records d. übergeordneten Elemente anhand der (noch weiter)
        // übergeordneten Elemente filtern
        let records = data[category].records.filter(r => {
            return selected.filter(s => s.category !== category).every(s => {
                return s.record ? r.fields[s.category] && r.fields[s.category].indexOf(s.record.id) > -1 : true
            });
        });

        // Optionsliste aus gefilteren Records aufbauen, aber gewählten Wert wiederherstellen
        let value = document.getElementById(category).value;
        populate_select(category, records);
        if (value !== "") document.getElementById(category).value = value;

        // gewählten Wert (d. übergeordneten Elements) als solchen speichern
        selected.push({ category: category, record: rec });
    });

    // gewählten Wert d. akt. Elements speichern
    selected.push({ category: curCategory, record: curRec });
    // akt. und alle untergeordneten Elemente durchlaufen
    categories.slice(categories.indexOf(e.srcElement.id)).forEach(category => {
        // Records anhand d. übergeordneten Elemente filtern
        let records = data[category].records.filter(r => {
            return selected.filter(s => s.category !== category).every(s => {
                return s.record ? r.fields[s.category] && r.fields[s.category].indexOf(s.record.id) > -1 : true
            });
        });
        // Optionsliste aus gefilteren Records aufbauen
        populate_select(category, records);
    });

    // im akt. Element gewählten Wert wiederherstellen
    if (curValue !== "") e.srcElement.value = curValue;
}


function save() {
    let record = {};
    // Record aus Formulareingaben ableiten
    allData.forEach(source => {
        let [rec] = data[source].records.filter(r => r.fields[source] === document.getElementById(source).value);
        record[source] = rec ? [rec.id] : [];
    });
    record["Name"]   = "";
    try {
        let datum = document.getElementById("Datum").bulmaCalendar.startDate;
        // Da die Zeit momentan irrelevant ist, auf mitten am Tag setzen,
        // so dass die Zeitverschiebung zw. Lokalzeit und UTC sich nicht auf den
        // Datumswert auswirkt (wg. toISOString())
        datum.setHours(15);
        record["Datum"]  = datum.toISOString().substring(0, 10);
    } 
    catch {}
    record["Notes"]  = document.getElementById("Bemerkungen").value;
    record["Assistent"] = document.getElementById("Assistent").value;
    record["Name"]   = [document.getElementById("Jahrgang").value
                       ,document.getElementById("Datum").value
                       ,document.getElementById("Dozent").value
                       ,document.getElementById("Assistent").value]
                    .filter(e => e != "")
                    .join("_");

    try {
        if (document.getElementById("Stunden") != "")
            record["Stunden"] = parseInt(document.getElementById("Stunden").value);
    } catch {}
                     
    // Speichern und Formular zurücksetzen
    try {
        base('Klassenbuch').create(record, (err, rec) => {
            if (err) {
                alert(err);
                return;
            }
            alert('Ein neuer Datensatz mit der ID: "' + rec.getId() + '" wurde angelegt.');
            
        });
    } catch (error) {
        console.error(error);
        alert("Fehler: Die Kommunikation mit airtable ist fehlgeschlagen, der Datensatz konnte nicht gespeichert werden!");
    }
}

function reset() {
    allData.forEach(source => {
        populate_select(source, data[source].records);
    });
    document.getElementById("Datum").bulmaCalendar.clear();
    document.getElementById("Bemerkungen").value = "";
    document.getElementById("Stunden").value = "";
    document.getElementById("Assistent").value = "";
}

const calendars = bulmaCalendar.attach('[type="date"]', {
    dateFormat: "DD.MM.YYYY",
    showHeader: false,
    showFooter: false,
    displayMode: "dialog",
    color: "link",
});

show_modal("login");