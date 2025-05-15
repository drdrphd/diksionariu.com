///
/// examples.js
///
/// Code for retrieveing and inserting contextual examples
///
/// getContextualExamples(string, Array)
///		- PHP call to retrieve from SQL database
/// formatContextualExamples(Array)
///		- prepare the PHP results for insertion
/// setupContext(Array)
///		- set up the HTML audio for the inserted examples
/// msToHrMinSec(int)
/// 	- helper function for ms to h:mm:ss conversion
///

//
// Get Contextual Examples
//
// getContextualExamples(string, [string, ...])
//
// Takes: div ID (where results will be inserted), Array of example IDs
// Returns: Array of results (
//
// Method: initiates PHP call and SQL query
//
function getContextualExamples(div_id, example_ids) {
	
	//display a loading circle while fetching results
	document.getElementById(div_id).innerHTML = "<span class=\"loading\">Loading . . .</span>";

	if (window.XMLHttpRequest)  xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			var results = formatContextualExamples(this.responseText);
			Promise.resolve()
			.then(() => {
				document.getElementById(div_id).innerHTML = results[1];
				setupContext(results[0]);
			}).then(() => {
				advancedViewToggle(true);	//run at onset
				for (var a of document.getElementsByClassName("expanded-example-view")) {
					a.checked = page_settings["expanded_examples"];
					a.addEventListener("change", function(){advancedViewToggle()});
				}
			});
		}
	};		
	xmlhttp.open("GET","examples.php?q=" + encodeURIComponent(JSON.stringify(example_ids)),true);
	xmlhttp.send();
}

//
// Format Contextual Examples
//
// formatContextualExamples([SQL/PHP results array])
//
// Takes: array of results from PHP call (strings, numbers, URLS, HTML)
//		(may have multiple results)
// Returns: [[example IDs], formatted HTML string to insert]
//
function formatContextualExamples(results) {
	
	var formatted_results = "";
	var combined_results = "";	//for multiple examples
	var ids_and_times = [];
	
	//SQL returns a "0" if entry not found -- easier for debugging, can see that something was returned
	if (results == "0") {
		formatted_results = "<p class='no-result'>Example(s) not found</p></br>";
	
	} else {
		results = JSON.parse(results); //overwrite with parse
		
		for (var i = 0; i < results.length; i++) {
			
			ids_and_times.push([results[i].id, results[i].start_time_ms, results[i].end_time_ms]);
			
			//combine: Consultant - Project
			results[i].consultant = results[i].consultant + " - " + results[i].project;
			
			//link to project if URL exists (overwrite consultant info with linked consultant info)
			if(typeof results[i].consultant_url !== 'undefined')		results[i].consultant = " <a href='" + results[i].consultant_url + "'>" + results[i].consultant + "</a>";
			
			//assemble formatted HTML block
			formatted_results = 
				`<div class="attribution">` + results[i].consultant	+ `</div>`;
			formatted_results +=
				`<div class="attribution-source">` + results[i].file
				+ " " +
				`<a href='https://chachalani.com/viewer/viewer.php?id=` + results[i].file + `&t=` + results[i].start_time_ms/1000 + `'>(` + msToHrMinSec(results[i].start_time_ms)
				+ " - " + msToHrMinSec(results[i].end_time_ms) + `)</a></div>`;
			formatted_results +=
				`<div class="replay-container">
					<button id="replay-button-` + results[i].id + `" class="replay-selection"></button>
					<div class="replay-selection-text">Play Selection</div>
				</div>`;
			formatted_results += 	
				`<div id="audio-container-` + results[i].id + `" class="audio-container">
					<audio id="audio-` + results[i].id + `" controls preload="auto" >
						<source
						  src="` + results[i].audio_url + `"
						  type="audio/mp4" />
					</audio>
				</div>`;
			formatted_results +=
				`<div><label class="slider"><input type="checkbox" class="expanded-example-view"><span class="jot"></span></label><span class="clides-text">Expanded View</span>`
				+ results[i].example_html + `</div>`;
			formatted_results =
				`<details open><summary>`
					+ `<span class="open"><a>[▲ Hide]</a></span><span class="closed"><a>[▼ Show]</a></span></summary>`
					+ formatted_results + `</details>`;
			combined_results += formatted_results;
		}
	}
	
	return [ids_and_times, combined_results];
}

//
// Setup Contextual Example HTML Elements
//
// setupContext([ids_and_times])
//	 array order: [[id, start_ms, end_ms], ...]
//
// Takes: array of example IDs and times
//
// Method: sets up listeners in newly added example HTML
//
function setupContext(ids_and_times) {
	for (var i = 0; i < ids_and_times.length; i++) {
		
		const replay_button = document.getElementById("replay-button-" + ids_and_times[i][0]);
		//need the actual values in the function to be executed later
		eval('replay_button.addEventListener("click", function(){replayToggle('
			+ (ids_and_times[i][1] / 1000) + ','
			+ (ids_and_times[i][2] - ids_and_times[i][1]) + ')});');

		const audio = document.getElementById("audio-" + ids_and_times[i][0]);
		audio.addEventListener("playing", () => {
			replay_button.classList.add("replay-selection-stop");
		});
		audio.addEventListener("pause", () => {
			replay_button.classList.remove("replay-selection-stop");
		});
		var playbackTimer;	//for setTimeout and clearTimeout

		function replayToggle(curr, dur) {
			if (audio.paused == false) {
				audio.pause();
				clearTimeout(playbackTimer);
			} else if (audio.paused == true) {
				audio.currentTime = curr; //HTML Audio requires time in seconds
				audio.play();
				playbackTimer = setTimeout(function(){audio.pause();}, dur );	//setTimeout requires time in ms
			}
		}
	}
}

//
// Advanced-View Slider Toggle
//
// advancedViewToggle(init)
//
// Takes: Boolean (true = first run to initialize)
//		***Relies on a global variable**
//		***Will not work without that***
//
// Method: sets up listeners for Advanced-View Sliders
//		Hides advanced elements in examples
//
function advancedViewToggle(init = false) {
	if (init) page_settings["expanded_examples"] = !page_settings["expanded_examples"];	//pre-swap to swap back (hacky initialization)
	if (page_settings["expanded_examples"] == true) {	//page_settings is a global object on the main page
		for (var e of document.getElementsByClassName("time-aligned-stack")) e.classList.add('hidden');
		page_settings["expanded_examples"] = false;
	} else {
		for (var e of document.getElementsByClassName("time-aligned-stack")) e.classList.remove('hidden');
		page_settings["expanded_examples"] = true;
	}
}


//
// msToHrMinSec(int)
//
// Converts milliseconds to Hour:Minute:Second (hh:mm:ss) display times
// Uses toISOString function of built in Date class
//
function msToHrMinSec(ms) {
	var hours = Math.floor(ms / 3600000);
	var minutes = Math.floor((ms % 3600000) / 60000);
	var seconds = Math.floor((ms % 60000) / 1000);
	if (seconds == 60) {minutes += 1; seconds = 0;}
	return (minutes == 60 ? (hours+1) + ":00:" + (seconds < 10 ? "0" : "") : hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds);
}