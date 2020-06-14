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


// Kontext ist gedacht als:
// Objekt, das pro Table eine Zuordnung von alten und neuen IDs enth.
// Bsp: { Fach: { 1: "9", 2: "7", usw. }, Fachbereich: { 861: "657", usw.. }}
// Daneben enth. der Kontext Hilfsfunktionen, um Backup-Records in die korrekt Form
// f. restore zu bringen
function createMappingContext() {
	const ctx = {
		Fach : {
			formatRecord: function(rec) {
				return {
					"fields": { "Fach": rec.fields.Fach }
				};
			},
			getId: function(rec) {
				return (rec.fields.Fach ?
					[this[rec.fields.Fach[0]]] :
					[]);
			}
		},
		
		Fachbereich: {
			formatRecord: function(rec) {
				return {
					"fields": {
						"Fachbereich": rec.fields.Fachbereich,
						"Fach": ctx.Fach.getId(rec)
					}
				};
			},
			getId: function(rec) {
				return (rec.fields.Fachbereich ?
					[this[rec.fields.Fachbereich[0]]] :
					[]);
			}
		},

		Thema: {
			formatRecord: function(rec) {
				return  {
					"fields": {
						"Thema": rec.fields.Thema,
						"Fachbereich": ctx.Fachbereich.getId(rec),
						"Fach": ctx.Fach.getId(rec)
					}
				};
			},
			getId: function(rec) {
				return (rec.fields.Thema ?
					[this[rec.fields.Thema[0]]] :
					[]);
			}
		},

		Themenbereich: {
			formatRecord: function(rec) {
				return {
					"fields": {
						"Themenbereich": rec.fields.Themenbereich,
						"Thema": ctx.Thema.getId(rec),
						"Fachbereich": ctx.Fachbereich.getId(rec),
						"Fach": ctx.Fach.getId(rec)
					}
				};
			},
			getId: function(rec) {
				return (rec.fields.Themenbereich ?
					[this[rec.fields.Themenbereich[0]]] :
					[]);
			}
		},

		Dysfunktionen: {
			formatRecord: function(rec) {
				return {
					"fields": {
						"Dysfunktionen": rec.fields.Dysfunktionen,
						"Themenbereich": ctx.Themenbereich.getId(rec),
						"Thema": ctx.Thema.getId(rec),
						"Fachbereich": ctx.Fachbereich.getId(rec),
						"Fach": ctx.Fach.getId(rec)
					}
				};
			},
			getId: function(rec) {
				return (rec.fields.Dysfunktionen ?
					[this[rec.fields.Dysfunktionen[0]]] :
					[]);
			}
		},

		Pathologie: {
			formatRecord: function(rec) {
				return {
					"fields": {
						"Pathologie": rec.fields.Pathologie,
						"Dysfunktionen": ctx.Dysfunktionen.getId(rec),
						"Themenbereich": ctx.Themenbereich.getId(rec),
						"Thema": ctx.Thema.getId(rec),
						"Fachbereich": ctx.Fachbereich.getId(rec),
						"Fach": ctx.Fach.getId(rec)
					}
				};
			},
			getId: function(rec) {
				return (rec.fields.Pathologie ?
					[this[rec.fields.Pathologie[0]]] :
					[]);
			}
		},

		Dozent: {
			formatRecord: function(rec) {
				return {
					"fields": { "Dozent": rec.fields.Dozent }
				};
			},
			getId: function(rec) {
				return (rec.fields.Dozent ?
					[this[rec.fields.Dozent[0]]] :
					[]);
			}
		},

		Jahrgang: {
			formatRecord: function(rec) {
				return {
					"fields": { "Jahrgang": rec.fields.Jahrgang }
				};
			},
			getId: function(rec) {
				return (rec.fields.Jahrgang ? 
					[this[rec.fields.Jahrgang[0]]] :
					[]);
			}
		},

		Klassenbuch: {
			formatRecord: function(rec) {
				return {
					"fields": {
						"Name": rec.fields.Name,
						"Dozent": ctx.Dozent.getId(rec),
						"Assistent": rec.fields.Assistent,
						"Jahrgang": ctx.Jahrgang.getId(rec),
						"Datum": rec.fields.Datum,
						"Notes": rec.fields.Notes,
						"Fach": ctx.Fach.getId(rec),
						"Fachbereich": ctx.Fachbereich.getId(rec),
						"Thema": ctx.Thema.getId(rec),
						"Themenbereich": ctx.Themenbereich.getId(rec),
						"Dysfunktionen": ctx.Dysfunktionen.getId(rec),
						"Pathologie": ctx.Pathologie.getId(rec),
						"Stunden": rec.fields.Stunden
					}
				};
			}
		}
	};

	return Promise.resolve(ctx);
}

function restore(table, ctx) {
	const processRecords = (records, resolve, reject, offset=0) => {
		if (offset >= records.length) {
			console.log(`... ${table} fertig`);
			return resolve(ctx);
		}
		// airtable max. 10 pro request
		let bckRecords = records.slice(offset, offset+10);
		base(table).create(bckRecords.map(ctx[table].formatRecord), (err, createdRecords) => {
			if (err) return reject(err);
			createdRecords.forEach(rec => {
				// da automatisch neue IDs vergeben werden, muessen wir
				// die alte (aus dem Backup) und die neue ID verknuepfen
				let old = bckRecords.find(element => 
					element.fields[table] === rec.get(table))
				ctx[table][old.id] = rec.getId();
			});
			processRecords(records, resolve, reject, offset+10)
		});
	}

	return new Promise((resolve, reject) => {
		console.log(table);
		fs.readFile(`${restorePath}/${table}.json`, "utf8", (err, data) => {
			if (err) return reject(err);
			let backup_data = JSON.parse(data).records.sort(
				(rec1, rec2) => rec1.fields.Counter - rec2.fields.Counter);
			processRecords(backup_data, resolve, reject);
		});
	});
}

function restoreAll() {
	createMappingContext()
		.then(ctx => restore("Fach", ctx))
		.then(ctx => restore("Fachbereich", ctx))
		.then(ctx => restore("Thema", ctx))
		.then(ctx => restore("Themenbereich", ctx))
		.then(ctx => restore("Dysfunktionen", ctx))
		.then(ctx => restore("Pathologie", ctx))
		.then(ctx => restore("Dozent", ctx))
		.then(ctx => restore("Jahrgang", ctx))
		.then(ctx => restore("Klassenbuch", ctx))
		.catch(err => console.error(err))
};

restoreAll()
