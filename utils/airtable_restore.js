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


function createMappingContext() {
	return Promise.resolve({});
}

function restore(table, stringifyRecord, ctx) {
	let processRecords = (records, stringifyRecord, table, ctx, resolve, reject, offset=0) => {
		if (offset >= records.length) {
			console.log(`... ${table} fertig`);
			return resolve(ctx);
		}
		// airtable max. 10 pro request
		let bckRecords = records.slice(offset, offset+10);
		base(table).create(bckRecords.map(rec => stringifyRecord(ctx, rec)), (err, createdRecords) => {
			if (err) return reject(err);
			createdRecords.forEach(rec => {
				// da automatisch neue IDs vergeben werden, muessen wir
				// die alte (aus dem Backup) und die neue ID verknuepfen
				let old = bckRecords.find(element => 
					element.fields[table] === rec.get(table))
				ctx[table][old.id] = rec.getId();
			});
			processRecords(records, stringifyRecord, table, ctx, resolve, reject, offset+10)
		});
	}

	return new Promise((resolve, reject) => {
		console.log(table);
		ctx[table] = {};
		fs.readFile(`${restorePath}/${table}.json`, "utf8", (err, data) => {
			if (err) return reject(err);
			let backup_data = JSON.parse(data).records.sort(
				(rec1, rec2) => rec1.fields.Counter - rec2.fields.Counter);
			processRecords(backup_data, stringifyRecord, table, ctx, resolve, reject);
		});
	});
}

function getFachId(mapping, rec) {
	try {
		return [mapping.Fach[rec.fields.Fach[0]]]
	} catch {
		return []
	}
}
function getFachbereichId(mapping, rec) {
	try {
		return [mapping.Fachbereich[rec.fields.Fachbereich[0]]]
	} catch {
		return []
	}
}
function getThemaId(mapping, rec) {
	try {
		return [mapping.Thema[rec.fields.Thema[0]]];
	} catch {
		return [];
	}
}
function getThemenbereichId(mapping, rec) {
	try {
		return [mapping.Themenbereich[rec.fields.Themenbereich[0]]];
	} catch {
		return [];
	}
}
function getDysfunktionenId(mapping, rec) {
	try {
		return [mapping.Dysfunktionen[rec.fields.Dysfunktionen[0]]];
	} catch {
		return [];
	}
}
function getPathologieId(mapping, rec) {
	try {
		return [mapping.Pathologie[rec.fields.Pathologie[0]]];
	} catch {
		return [];
	}
}
function getDozentId(mapping, rec) {
	try {
		return [mapping.Dozent[rec.fields.Dozent[0]]];
	} catch {
		return [];
	}
}
function getJahrgangId(mapping, rec) {
	try {
		return [mapping.Jahrgang[rec.fields.Jahrgang[0]]];
	} catch {
		return [];
	}
}

// TODO mapping context / stringify-funktion in einem Objekt zusammenfuehren?
function restoreAll() {
	createMappingContext()
		.then(ctx => restore("Fach", 
				(_, rec) => 
				({
					"fields":
					{
						"Fach": rec.fields.Fach
					}
				}), ctx))
		.then(ctx => restore("Fachbereich", 
				(mapping, rec) => 
				({
					"fields":
					{
						"Fachbereich": rec.fields.Fachbereich,
						"Fach": getFachId(mapping, rec)
					}
				}), ctx))
		.then(ctx => restore("Thema",
				(mapping, rec) => 
				({
					"fields":
					{
						"Thema": rec.fields.Thema,
						"Fachbereich": getFachbereichId(mapping, rec),
						"Fach": getFachId(mapping, rec)
					}
				}), ctx))
		.then(ctx => restore("Themenbereich",
				(mapping, rec) => 
				({
					"fields":
					{
						"Themenbereich": rec.fields.Themenbereich,
						"Thema": getThemaId(mapping, rec),
						"Fachbereich": getFachbereichId(mapping, rec),
						"Fach": getFachId(mapping, rec)
					}
				}), ctx))
		.then(ctx => restore("Dysfunktionen",
				(mapping, rec) => 
				({
					"fields":
					{
						"Dysfunktionen": rec.fields.Dysfunktionen,
						"Themenbereich": getThemenbereichId(mapping, rec),
						"Thema": getThemaId(mapping, rec),
						"Fachbereich": getFachbereichId(mapping, rec),
						"Fach": getFachId(mapping, rec)
					}
				}), ctx))
		.then(ctx => restore("Pathologie",
				(mapping, rec) => 
				({
					"fields":
					{
						"Pathologie": rec.fields.Pathologie,
						"Dysfunktionen": getDysfunktionenId(mapping, rec),
						"Themenbereich": getThemenbereichId(mapping, rec),
						"Thema": getThemaId(mapping, rec),
						"Fachbereich": getFachbereichId(mapping, rec),
						"Fach": getFachId(mapping, rec)
					}
				}), ctx))
		.then(ctx => restore("Dozent", 
				(_, rec) => 
				({
					"fields":
					{
						"Dozent": rec.fields.Dozent
					}
				}), ctx))
		.then(ctx => restore("Jahrgang", 
				(_, rec) => 
				({
					"fields":
					{
						"Jahrgang": rec.fields.Jahrgang
					}
				}), ctx))
		.then(ctx => restore("Klassenbuch",
				(mapping, rec) => 
				({
					"fields":
					{
						"Name": rec.fields.Name,
						"Dozent": getDozentId(mapping, rec),
						"Assistent": rec.fields.Assistent,
						"Jahrgang": getJahrgangId(mapping, rec),
						"Datum": rec.fields.Datum,
						"Notes": rec.fields.Notes,
						"Fach": getFachId(mapping, rec),
						"Fachbereich": getFachbereichId(mapping, rec),
						"Thema": getThemaId(mapping, rec),
						"Themenbereich": getThemenbereichId(mapping, rec),
						"Dysfunktionen": getDysfunktionenId(mapping, rec),
						"Pathologie": getPathologieId(mapping, rec),
						"Stunden": rec.fields.Stunden
					}
				}), ctx))
		.catch(err => console.error(err))
};

restoreAll()
