const Airtable = require('airtable');
const fs = require('fs');

function backup() {
	let _apiKey, _base, backupPath;
	process.argv.forEach(arg => {
		let kv = arg.split("=");
		if (kv[0].toLowerCase() === "apikey")
			_apiKey = kv[1];
		else if (kv[0].toLowerCase() === "base")
			_base = kv[1]
		else if (kv[0].toLowerCase() === "backuppath")
			backupPath = kv[1]
	});

	const base = new Airtable({
	    apiKey: _apiKey,
	}).base(_base);

	const categories = 
		["Fach", "Fachbereich", "Thema", "Themenbereich"
		, "Dysfunktionen", "Pathologie", "Jahrgang"
		, "Dozent", "Klassenbuch"];
	
	fs.accessSync(backupPath, fs.constants.W_OK);

	let data = {};
	categories.forEach(cat => {
		data[cat] = {"records":[]}
		base(cat).select().eachPage((records, nextPage) => {
			records.forEach(rec => {
				data[cat].records.push(rec);
			});
			nextPage();
		}, err => {
			if (err) throw err;
			fs.writeFile(`${backupPath}/${cat}_${Date.now()}.json`, 
				JSON.stringify(data[cat]), err => {
				if (err) throw err;
			});
		});
	});
}

try {
	backup();
} catch(err) {
	console.error(err)
	return 1;
}
return 0;
