///
/// get-CSV
/// 
/// Methods: 
///


/** Convert a 2D array into a CSV string
 * Source: https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
 * A minimalistic yet feature-complete solution :)
 */
function arrayToCsv(data){
  return data.map(row =>
	row
	.map(String)  // convert every value to String
	.map(v => v.replaceAll('"', '""'))  // escape double quotes
	.map(v => `"${v}"`)  // quote it
	.join(',')  // comma-separated
  ).join('\r\n');  // rows starting on new lines
}


/** Download contents as a file
 * Source: https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
 */
function downloadBlob(content, filename, contentType) {
  // Create a blob
  var blob = new Blob([content], { type: contentType });
  var url = URL.createObjectURL(blob);

  // Create a link to download it
  var pom = document.createElement('a');
  pom.href = url;
  pom.setAttribute('download', filename);
  pom.click();
}


//
// Get data from PHP function
// Process with above functions
//
function getCSV() {
		
	if (window.XMLHttpRequest)  xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = function() {
		if (this.readyState === XMLHttpRequest.DONE) {
			if (this.status !== 200) {
				console.error("Error: " + this.status);
				hide(document.getElementById("download-spinner"));
			} else {
				var response = JSON.parse(this.responseText);
				var dict_table = [["index_num","hashed_entry","entry","CNMI_entry","part_of_speech","origin","alternate_forms","related_forms","see_also","notes","definition","examples","source","context_examples","last_edited"]];
				for (var i = 0; i < response.length; i++) {
					var new_row = [[response[i].index_num, response[i].hashed_entry, response[i].entry, response[i].CNMI_entry, response[i].part_of_speech, response[i].origin,
									response[i].alternate_forms, response[i].related_forms, response[i].see_also, response[i].notes, 
									response[i].definition, response[i].examples, response[i].source, response[i].context_examples, response[i].last_edited]];
					dict_table = dict_table.concat(new_row);
				}
				const d = new Date;
				downloadBlob("\uFEFF"	//Byte Order Mark -- helps Excel, etc. interpret as UTF-8
							 + arrayToCsv(dict_table),	//stringified dictionary
							 'diksionariu_' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + '.csv',	//filename with current date YYYY-M-D (getMonth is 0-indexed???)
							 'text/csv;charset=utf-8;');	//unicode encoding for lonat, accents, etc.
				hide(document.getElementById("download-spinner"));
			}
		}
	};
	
	xmlhttp.open("GET","gettable.php",true);
	xmlhttp.send();
}


document.getElementById("full-download").addEventListener("click", function(){
		show(document.getElementById("download-spinner"));
		getCSV();
	});