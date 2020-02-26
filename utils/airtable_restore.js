const fs = require('fs');
const Airtable = require('airtable');

let _apiKey, _base, restorePath
process.argv.forEach(arg => {
	let kv = arg.split("=");
	if (kv[0].toLowerCase() === "apikey")
		_apiKey = kv[1];
	else if (kv[0].toLowerCase() === "base")
		_base = kv[1]
	else if (kv[0].toLowerCase() === "restorepath")
		restorePath = kv[1]
});

const base = new Airtable({
    apiKey: _apiKey,
}).base(_base);


let mapping = {};
function processRecords(records, stringifyRecord, table, next, offset=0) {
	if (offset >= records.length) {
		try { 
			console.log(`... ${table} fertig`);
			next(); 
		} 
		catch {}
		finally { return; }
	}
	// airtable max. 10 pro request
	let bckRecords = records.slice(offset, offset+10);
	base(table).create(bckRecords.map(stringifyRecord), (err, createdRecords) => {
		if (err) {
			console.error(`${table}, Fehler: ${err}`);
			return;
		}
		createdRecords.forEach(rec => {
			// da automatisch neue IDs vergeben werden, muessen wir
			// die alte (aus dem Backup) und die neue ID verknuepfen
			let old = bckRecords.find(element => 
				element.fields[table] === rec.get(table))
			mapping[table][old.id] = rec.getId();
		});
		processRecords(records, stringifyRecord, table, next, offset+10)
	});
}
function restore(table, stringifyRecord, next=null) {
	return function() {
		console.log(table);

		mapping[table] = {};
		fs.readFile(`${restorePath}/${table}.json`, "utf8", (err, data) => {
			if (err) throw err;
			let backup_data = JSON.parse(data).records.sort(
				(rec1, rec2) => rec1.fields.Counter - rec2.fields.Counter);
			processRecords(backup_data, stringifyRecord, table, next);
		});
	}
}

function getFachId(rec) {
	try {
		return [mapping.Fach[rec.fields.Fach[0]]]
	} catch {
		return []
	}
}
function getFachbereichId(rec) {
	try {
		return [mapping.Fachbereich[rec.fields.Fachbereich[0]]]
	} catch {
		return []
	}
}
function getThemaId(rec) {
	try {
		return [mapping.Thema[rec.fields.Thema[0]]];
	} catch {
		return [];
	}
}
function getThemenbereichId(rec) {
	try {
		return [mapping.Themenbereich[rec.fields.Themenbereich[0]]];
	} catch {
		return [];
	}
}
function getDysfunktionenId(rec) {
	try {
		return [mapping.Dysfunktionen[rec.fields.Dysfunktionen[0]]];
	} catch {
		return [];
	}
}
function getPathologieId(rec) {
	try {
		return [mapping.Pathologie[rec.fields.Pathologie[0]]];
	} catch {
		return [];
	}
}
function getDozentId(rec) {
	try {
		return [mapping.Dozent[rec.fields.Dozent[0]]];
	} catch {
		return [];
	}
}
function getJahrgangId(rec) {
	try {
		return [mapping.Jahrgang[rec.fields.Jahrgang[0]]];
	} catch {
		return [];
	}
}


(function restoreAll() {
	restore("Fach", 
		rec => 
		({
			"fields":
			{
				"Fach": rec.fields.Fach
			}
		}),
	restore("Fachbereich", 
		rec => 
		({
			"fields":
			{
				"Fachbereich": rec.fields.Fachbereich,
				"Fach": getFachId(rec)
			}
		}),
	restore("Thema",
		rec => 
		({
			"fields":
			{
				"Thema": rec.fields.Thema,
				"Fachbereich": getFachbereichId(rec),
				"Fach": getFachId(rec)
			}
		}), 
	restore("Themenbereich",
		rec => 
		({
			"fields":
			{
				"Themenbereich": rec.fields.Themenbereich,
				"Thema": getThemaId(rec),
				"Fachbereich": getFachbereichId(rec),
				"Fach": getFachId(rec)
			}
		}), 
	restore("Dysfunktionen",
		rec => 
		({
			"fields":
			{
				"Dysfunktionen": rec.fields.Dysfunktionen,
				"Themenbereich": getThemenbereichId(rec),
				"Thema": getThemaId(rec),
				"Fachbereich": getFachbereichId(rec),
				"Fach": getFachId(rec)
			}
		}), 
	restore("Pathologie",
		rec => 
		({
			"fields":
			{
				"Pathologie": rec.fields.Pathologie,
				"Dysfunktionen": getDysfunktionenId(rec),
				"Themenbereich": getThemenbereichId(rec),
				"Thema": getThemaId(rec),
				"Fachbereich": getFachbereichId(rec),
				"Fach": getFachId(rec)
			}
		}), 
	restore("Dozent", 
		rec => 
		({
			"fields":
			{
				"Dozent": rec.fields.Dozent
			}
		}),
	restore("Jahrgang", 
		rec => 
		({
			"fields":
			{
				"Jahrgang": rec.fields.Jahrgang
			}
		}),
	restore("Klassenbuch",
		rec => 
		({
			"fields":
			{
				"Name": rec.fields.Name,
				"Dozent": getDozentId(rec),
				"Assistent": rec.fields.Assistent,
				"Jahrgang": getJahrgangId(rec),
				"Datum": rec.fields.Datum,
				"Notes": rec.fields.Notes,
				"Fach": getFachId(rec),
				"Fachbereich": getFachbereichId(rec),
				"Thema": getThemaId(rec),
				"Themenbereich": getThemenbereichId(rec),
				"Dysfunktionen": getDysfunktionenId(rec),
				"Pathologie": getPathologieId(rec),
				"Stunden": rec.fields.Stunden
			}
		}), 
	)))))))))();
})();
