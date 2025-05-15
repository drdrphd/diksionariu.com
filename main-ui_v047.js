///
/// main-ui.js
///
/// Various methods for control of UI
///
/// Methods:
///		Global UI methods for hide / show
///			hide(CSS) -- adds 'hidden' class to element
///			show(CSS) -- removes 'hidden' class from element
///		Main loop listeners
///			(search bar, buttons, tabs, dropdown, hover)
///		Dropdown-search interaction
///			populateSearchDropdown(String) -- runs a PHP/SQL query, returns up to 10 look-aheads/-behinds
///			formatForSearchDropdown(String, JSON Object) -- format results from SQL query and insert
///			navigateSearchDropdown(direction) -- from keypress, cycle through suggestions
///		Pop-up on hover controls
///			populatePopup(String) -- runs a PHP/SQL query
///			formatForPopup(String, JSON Object) -- format results from SQL query and insert
///													also, get morph parses if no results from SQL query
///				norm(str) -- deaccent and remove ' -
///				formatText(Array [, String]) -- Add formatting around results
///				markupText(String) -- Replace markup with HTML tags, classes for popup
///			clearPopup()
///		Browse-By-Letter (set up indexes)
///			populateBrowseByLetter() -- called from PHP, adds main-page links for each letter
///


//
// Global UI methods
//

//
// hide
//
function hide(to_hide) {
	to_hide.classList.add("hidden");
}

//
// show
//
function show(to_show) {
	to_show.classList.remove("hidden");
	to_show.removeAttribute("hidden");
}




//
// Global Page Settings
//
// Includes styling options (e.g., examples)
//
var page_settings = {
	current_search: "CH",	//values: CH, Eng
	expanded_examples: false	//for contextual examples
};

//Setup global retrieval trie objects
//(for Morphological parsing)
var tries = {};
tries.words = new Trie();
tries.non_aff_words = new Trie();	//non-affixing words (mostly small function words)
tries.affixes = new Trie();
	
//add words to word_trie
//Creates Trie with deaccented forms...
//but includes accented forms at end nodes in properties
//	Tries are fast but fairly rigid...
//	methods to allow other characters are complicated or lengthy
//	We'll deaccent and then possibly filter at the end
for (var i = 0; i < words.length; i++) {
	tries.words.insert(deaccent(words[i].split("/", 1)[0].toLowerCase()), words[i]);
}

//add words to non_affixing_word_trie
for (var i = 0; i < non_affixing_words.length; i++) {
	tries.non_aff_words.insert(deaccent(non_affixing_words[i].split("/", 1)[0].toLowerCase()), non_affixing_words[i]);
}

//add affixes to affix_trie
for (var i = 0; i < affixes.length; i++) {
	tries.affixes.insert(deaccent(affixes[i].add.split("/", 1)[0].toLowerCase()), affixes[i]);
}
	



//
// Main Loop
//
// Includes various action listeners (keyboard, buttons, etc.)
//
window.onload = function(){
	const loading_indicators = document.getElementsByClassName("loading");
	const search_bar = document.getElementById("entry");
	const search_button = document.getElementById("entry-submit");
	const search_dropdown = document.getElementById("search-dropdown");
	const search_and_dropdown = document.getElementById("search-and-dropdown");
	const search_tabs = document.getElementById("search-tabs").children;
	const hover_preview_popup = document.getElementById('hover-preview-popup');
	const results_div = document.getElementById('results');	//may be null
	
	var dropdown_timeout;	//prevent bounce
	var last_search_value = "";	//don't look up suggestions if nothing changed
	var dropdown_highlighted = "";	//for arrow navigation
	
	var popup_timer;	//time from hover to popup
	
	
	//
	// ************************
	// *** Listeners and UI ***
	// ************************
	//
	
	//onload setup
	for (var i=0; i<loading_indicators.length; i++) hide(loading_indicators[i]);
	search_button.disabled = false;
	
	
	//listeners
	search_tabs[0].addEventListener("click", function(){	//CH->Eng
		page_settings.current_search = "CH";
		search_tabs[0].classList.add("current");
		search_tabs[1].classList.remove("current");
		search_bar.classList.remove("entry-english");
	});
	search_tabs[1].addEventListener("click", function(){	//Eng->CH
		page_settings.current_search = "Eng";
		search_tabs[1].classList.add("current");
		search_tabs[0].classList.remove("current");
		search_bar.classList.add("entry-english");
	});
	
	search_bar.addEventListener("keyup", function(event) {
		if (event.key === "Enter" && page_settings.current_search == "CH") {
			search(document.getElementById("entry").value, "CH");
		} else if (event.key === "Enter" && page_settings.current_search == "Eng") {
			search(document.getElementById("entry").value, "Eng");
		} else if (event.key === "Escape") {
			hide(search_dropdown);
			hide(hover_preview_popup);
		} else if (event.key === "ArrowDown" || event.key === "Down") {	//some older browsers used 'Down'
			navigateSearchDropdown('down');
		} else if (event.key === "ArrowUp" || event.key === "Up") {	//some older browsers used 'Up'
			navigateSearchDropdown('up');
		} else {
			if ((search_bar.value.length > 0) && (page_settings.current_search == "CH")) {
				populateSearchDropdown(search_bar.value);
			} else {
				hide(search_dropdown);
			}
		}
	});
	document.addEventListener("mousedown", function(event) {
		if (search_bar.contains(event.target) && (page_settings.current_search == "CH")) {
			if (last_search_value != search_bar.value) {
				populateSearchDropdown(search_bar.value);
				last_search_value = search_bar.value;
			} else if (search_bar.value.length > 0) {
				show(search_dropdown);	//show current results if nothing changed
			}
		}
		if (!search_bar.contains(event.target) && !search_dropdown.contains(event.target)) {
			hide(search_dropdown);
		}
	});
	document.addEventListener("touchstart", function(event) {
		if (search_bar.contains(event.target) && (page_settings.current_search == "CH")) {
			if (last_search_value != search_bar.value) {
				populateSearchDropdown(search_bar.value);
				last_search_value = search_bar.value;
			} else if (search_bar.value.length > 0) {
				show(search_dropdown);	//show current results if nothing changed
			}
		}
		if (!search_bar.contains(event.target) && !search_dropdown.contains(event.target)) {
			hide(search_dropdown);
		}
	});
	search_button.addEventListener("click", function() {
		if (page_settings.current_search == "CH")  search(document.getElementById("entry").value, "CH");
		if (page_settings.current_search == "Eng")  search(document.getElementById("entry").value, "Eng");
	});
	
	//For internal links and example text in results div (if extant)
	//pop-up a preview on link hover (after delay - 500ms)
	if (results_div) {
		results_div.addEventListener('mouseover', (event) => {
			if (event.target.closest('.internal-link')) {
				const e = event.target;
				const rect = e.getBoundingClientRect();	//link position on page
				popup_timer = setTimeout(() => {
					//position the popup div
					if (rect.left > (window.innerWidth / 2)) {
						hover_preview_popup.style.left = rect.right + window.scrollX - 300 + "px";
					} else {
						hover_preview_popup.style.left = rect.left + window.scrollX + "px";
					}
					if (rect.top > (window.innerHeight / 2)) {
						hover_preview_popup.style.top = rect.top + window.scrollY - 200 + "px"; //fixed 200px height
					} else {
						hover_preview_popup.style.top = rect.bottom + window.scrollY + "px";
					}
					var to_lookup = "";
					if (e.getAttribute('href')) {
						to_lookup = decodeURIComponent(e.getAttribute('href'));
					} else {
						to_lookup = e.innerText;
						to_lookup = to_lookup.replace(/[^a-zA-ZÅÁÉÍÓÚáéíóúåÑñ\-\']+/, '');	//take only alphabetic, accented, and - and '
					}
					populatePopup(to_lookup);
					show(hover_preview_popup);
				}, 500); //delay of 500ms on setTimeout timer
			}
		});
	}

	//For internal links in results div (if extant)
	//Clear pop-up timer when leaving hovered link,
	//but wait a small delay (100ms)to get in pop-up bounds
	if (results_div) {
		results_div.addEventListener('mouseout', (event) => {
			if (event.target.classList.contains('internal-link')) {
				clearTimeout(popup_timer);
				setTimeout(() => {
					if (!hover_preview_popup.matches(':hover')) {
						hide(hover_preview_popup);
						clearPopup();
					}
				}, 100); //delay to allow mouse to get in pop-up box
			}
		});
	}

	//Hide pop-up when not hovered (if it exists)
	if (hover_preview_popup) {
		hover_preview_popup.addEventListener('mouseleave', () => {
			hide(hover_preview_popup);
			clearPopup();
		});
	}

	//For internal links in popup div (if extant)
	//redirect preview on link hover (after delay - 750ms)
	if (hover_preview_popup) {
		hover_preview_popup.addEventListener('mouseover', (event) => {
			if (event.target.classList.contains('popup-link')) {
				const e = event.target;
				popup_timer = setTimeout(() => {
					populatePopup(decodeURIComponent(e.getAttribute('href')));
					clearTimeout(popup_timer);
				}, 750); //delay of 750ms on setTimeout timer (slightly longer due to navigation ease)
			}
		});
	}
	//clear popup link timer on mouseout
	if (hover_preview_popup) {
		hover_preview_popup.addEventListener('mouseout', (event) => {
			if (event.target.classList.contains('popup-link')) {
				clearTimeout(popup_timer);
			}
		});
	}
	
	
	//
	// *****************
	// *** Functions ***
	// *****************
	//
	
	
	//
	// Populate Search Dropdown
	//
	// populateSearchDropdown(str)
	//
	// Retrieves lookahead and lookbehind suggestions
	// Takes: the current search-bar query
	//
	function populateSearchDropdown(q) {
		//don't use for wildcard or compound searches
		if (q.includes("*") || q.includes("?") || q.includes("~") || q.includes(":")) {
			hide(search_dropdown);
			return;
		}
		
		if (q.length > 0) {
			clearTimeout(dropdown_timeout);
			dropdown_highlighted = "";
			dropdown_timeout = setTimeout(function () {
			var xmlhttp = new XMLHttpRequest();
			xmlhttp.onreadystatechange = function() {
				if (this.readyState == 4 && this.status == 200) {
					try {
						formatForSearchDropdown(q, xmlhttp.responseText);
						show(search_dropdown);
					} catch (error) {
						console.error("Could not access Lookup Table: ",error);
					}
				}
			};
			xmlhttp.open("GET","lookup.php?q=" + encodeURIComponent(q),true);
			xmlhttp.send();
			}, 100);	//debounce, 100ms
		}
	}
	
	//
	// Format for Search Dropdown
	//
	// formatForSearchDropdown(str, XML)
	//
	// Displays lookahead and lookbehind suggestions
	// Takes: passed query and results
	//
	function formatForSearchDropdown(q, results) {
		results = JSON.parse(results); //overwrite with parsed results
		//eventually might implement additional search boxes, for now just get first of each
		const dropdown_list = document.getElementsByClassName("search-dropdown-links")[0];
		const dropdown_suggest = document.getElementsByClassName("search-dropdown-suggest")[0];
		const dropdown_suggest_mobile = document.getElementsByClassName("search-dropdown-suggest-mobile")[0];
		
		//setup lookahead / lookbehind list
		dropdown_list.innerHTML = "";	//clear old content
		for (var i in results) {
			var lnk = encodeURIComponent(results[i].lookup);
			if (results[i].field == 'entry') 	//if term is a proper 'entry'...
				results[i].lookup = "<span class='dropdown-entry'>" + results[i].lookup + "</span>";	//...mark in bold
			
			dropdown_list.innerHTML += `<li><a class="dropdown-link" data-value="` + results[i].lookup_key + `" href="` + lnk + `">` + results[i].lookup + `</a></li>`;
		}
		
		//setup additional searches
		dropdown_suggest.innerHTML = "";
		example_lnk = encodeURIComponent("*::" + q.trim());
		fuzzy_lnk = encodeURIComponent("≈" + q.trim());
		dropdown_suggest.innerHTML += `<li><a class="dropdown-link dropdown-suggest-link" data-value="` + "*::" + q.trim() + `" href="` + example_lnk + `">Search examples</a></li>`;
		dropdown_suggest.innerHTML += `<li><a class="dropdown-link dropdown-suggest-link" data-value="` + "~"   + q.trim() + `" href="` + fuzzy_lnk   + `">Search approximate matches</a></li>`;
		dropdown_suggest_mobile.innerHTML = dropdown_suggest.innerHTML;
	}
	
	//
	// navigateSearchDropdown(Str)
	//
	// Allows arrow key navigation of search dropdown
	// Takes: a string, either 'up' or 'down'
	// 
	function navigateSearchDropdown(direction) {
		if (direction != "down" && direction != "up") return;	//just take up and down
		
		const dropdown_links = document.getElementsByClassName("dropdown-link");
		var visible_links = [];
		
		for (var i of dropdown_links) {
			if (i.checkVisibility())
				visible_links.push(i);
		}
		
		if (direction == "down") {
			if (dropdown_highlighted === "") {	//0 == "" <-- true, because javascript :|
				dropdown_highlighted = 0;
			} else {
				visible_links[dropdown_highlighted].parentElement.classList.remove("dropdown-selected");
				dropdown_highlighted++;
			}
			if (dropdown_highlighted >= visible_links.length) dropdown_highlighted = 0;
			visible_links[dropdown_highlighted].parentElement.classList.add("dropdown-selected");
			search_bar.value = visible_links[dropdown_highlighted].dataset.value;
		}
		if (direction == "up") {
			if (dropdown_highlighted === "") {	//0 == "" <-- true, because javascript :|
				dropdown_highlighted = visible_links.length - 1;
			} else {
				visible_links[dropdown_highlighted].parentElement.classList.remove("dropdown-selected");
				dropdown_highlighted--;
			}
			if (dropdown_highlighted < 0) dropdown_highlighted = visible_links.length - 1;
			visible_links[dropdown_highlighted].parentElement.classList.add("dropdown-selected");
			search_bar.value = visible_links[dropdown_highlighted].dataset.value;
		}
	}
	
	
	//
	// Populate Popup
	//
	// populatePopup(str)
	//
	// Retrieves entry / alternate forms for hovered internal links
	// Takes: hovered (site-internal-)href or innerText
	//
	// Calls search_popup.php and then passes results to formatForPopup
	//
	function populatePopup(q) {
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				try {
					formatForPopup(q, xmlhttp.responseText);
				} catch (error) {
					console.error("Could not access Database: ",error);
				}
			}
		};
		xmlhttp.open("GET","search_popup.php?q=" + encodeURIComponent(q),true);
		xmlhttp.send();
	}
	
	//
	// Format for Popup
	//
	// formatForPopup(str, JSON Object)
	//
	// Displays preview in hover popup
	// Takes: passed query and results
	//
	// Formats contents and inserts in popup div
	//
	function formatForPopup(q, results) {
		
		//helper function to deaccent text and remove ' -
		function norm(str) {
			str = str.normalize("NFD").replace(/[\u0300-\u036f'\-]/g, "");  //NFD : Canonical Unicode Decomposition
			str = str.toLowerCase();
			return str;
		}
		
		//helper function for formatting result text
		//(match_type can be 'exact' or 'alts')
		function formatText(arr, match_type) {
			var formatted = "";	//to assemble and return
			arr = arr.sort((a, b) => a.entry.localeCompare(b.entry))	//sort by entry alphabetically
			last_entry = "";	//collapse formatting a bit if 'entry' is spelled the same (to list)
			
			for (var i=0; i < arr.length; i++) {
				arr[i].alternate_forms = markupText(arr[i].alternate_forms);	//swap out markup for <..>
				arr[i].definition = markupText(arr[i].definition);				//swap out markup for <..>
				
				if (last_entry != arr[i].entry) {	//add word header if not same as last
					if (formatted.length > 0) formatted += "</ol>";	//close prior list for non-first headers
					var entry = "";
					//link all entries -- exact matches not listed as popup-links to prevent endless looping
					if (match_type == 'exact') {
						entry = '<a href="' + arr[i].entry + '">' + arr[i].entry + "</a>";	//don't loop as it's already displayed
					} else {
						entry = '<a class="popup-link" href="' + arr[i].entry + '">' + arr[i].entry + "</a>";
					}
					if (match_type == 'alts') {
						formatted += '<h3>' + entry + " <small>(" + arr[i].alternate_forms + ")</small></h3><ol>";
					} else {
						formatted += "<h3>" + entry + "</h3><ol>";
					}
				}
				//add to list for entries with same spelling
				formatted += "<li>(" + arr[i].part_of_speech + ") "
								+ arr[i].definition + "</li>";
				if (i == (arr.length - 1)) formatted += "</ol>";	//close list
				last_entry = arr[i].entry;
			}
			return formatted;
		}
		
		//helper function for markup in results
		//Sliiiiightly different from seach.js replaceMarkup() in that the links are of a different class
		//Probably could just add a parameter to the other one to designate popup or not... maybe if files are combined
		function markupText(str) {
	
			//swap out '''...''' for §, and then § for <b>...</b> tags
			str = str.replaceAll("''''","'§");	//for words that end in glotta -- will otherwise give §'
			str = str.replaceAll("'''","§");
			str = str.replace(/(§[^§]*§)/g,	//regex:  § [anything that's not §] §
				function(match) {
					return "<b>" + match.slice(1, -1) + "</b>";	//regex includes the starting and ending markup, so slice those out
				}
			);
			
			//swap out ~~...~~ for §, and then § for <i>...</i> tags
			str = str.replaceAll("~~","§");
			str = str.replace(/(§[^§]*§)/g,	//regex:  § [anything that's not §] §
				function(match) {
					return "<i>" + match.slice(1, -1) + "</i>";	//regex includes the starting and ending markup, so slice those out
				}
			);
			
			//swap out [[...]] for <a> ... </a> tags
			str = str.replace(/(\[\[[^\[]*\]\])/g,	//regex:  [[ + (anything that's not '[') + ]]
				function(match) {
					if (match.includes('|')) {
						var links = match.split('|');
						var probableURL = /[A-Za-z0-9]\.[A-Za-z0-9]{2}/;	//regex for likely URLs, which will probably have X.XX somewhere in them
						if (probableURL.test(links[1])) { //if (likely) external, do not use encodeURIComponent
							return "<a class='markup-link external-link' target='_blank' href=\"" + links[1].slice(0,-2) + "\">" + links[0].slice(2) + "</a>";	//regex includes the starting and ending markup, so slice those out
						} else {
							return "<a class='markup-link popup-link' href=\"" + encodeURIComponent(links[1].slice(0,-2)) + "\">" + links[0].slice(2) + "</a>";	//regex includes the starting and ending markup, so slice those out
						}
					} else {
						var lnk = encodeURIComponent(match.slice(2,-2));
						return "<a class='markup-link popup-link' href=\"" + lnk + "\">" + match.slice(2, -2) + "</a>";	//regex includes the starting and ending markup, so slice those out
					}
				}
			);
			
			//Templates
			//Shouldn't be seeing too many here, maybe {{}} (line break), which we'll swap for space
			str = str.replaceAll("{{}}"," ");
			
			return str;
		}
		
		const results_div = document.getElementById("hover-preview-popup").getElementsByClassName("results")[0];
		results = JSON.parse(results); //overwrite with parsed results
		var html_to_insert = "";
		
		if (results[0] == 0) {
			results_div.innerHTML ="<div class='no-result'>Not able to connect to database: </br>" + err + "</div>";
		}
		if (results[0] == 2) {
			//run morph analysis
			results_div.innerHTML = printDerivations(q, parse(q), true)[1];  //true for popup formatting, returns [Bool, HTML]
		}
		if (results[0] == 1) {
			res_exact = [], res_close = [], res_alts  = [];
			for (var i of results[1]) {
				if (i.entry == q) {
					res_exact.push(i);
				} else if (norm(i.entry) == norm(q)) {
					res_close.push(i);
				} else if (norm(i.alternate_forms).includes("[[" + norm(q) + "]]")) {
					res_alts.push(i);
				}
			}
			if (res_exact.length > 0) {
				html_to_insert = formatText(res_exact, 'exact') + "<br />";
			}
			if (res_close.length > 0) {
				html_to_insert += "<i>Close orthographic matches:</i><br /><br />" + formatText(res_close) + "<br />";
			}
			if (res_alts.length > 0) {
				html_to_insert += "<i>Alternate spellings:</i><br /><br />" + formatText(res_alts, 'alts');
			}
			
			results_div.innerHTML = html_to_insert;
			results_div.scrollTop = 0;	//scroll to top on refresh
		}
	}
	
	
	//
	// Clear Popup
	//
	// clearPopup()
	//
	// Wipes results from popup and replaces with load div
	//
	function clearPopup() {
		document.getElementById("hover-preview-popup").getElementsByClassName("results")[0].innerHTML
			= "<div class='load'></div>";
	}
};



//
// Populate Browse-By-Letter
//
// Called from index.php...
// Indexes are retrieved for where A,B,CH start from SQL...
// Stored as a global object (const letter_indexes)
// Then we call this function to add letter <div>s
//
function populateBrowseByLetter(){
	
	var letter_divs = "";
	var display_letter = "";
	var display_index = 1;
	
	if(letter_indexes !== null){
		for (var i=0; i<letter_indexes.length; i++) {
			if(letter_indexes[i].letter.toLowerCase() == 'c') {
				display_letter = "CH";
			} else {
				display_letter = letter_indexes[i].letter.toUpperCase();
				display_letter = display_letter.normalize("NFD").replace(/[\u0300-\u036f'\-]/g, "");  //NFD : Canonical Unicode Decomposition  (de-accent)
			}
			if(+letter_indexes[i].start_index > 1) {  //anything later than A, adjust down by a fraction of the display window (currently 20)
				display_index = +letter_indexes[i].start_index + 2; 	// CHANGE (2) TO NOT HARD CODED
			} else {
				display_index = +letter_indexes[i].start_index;
			}
			letter_divs += 
				"<a href='search.php?i=" + display_index + "&h=0'>" +
					"<div class='browse-by-letter'>" + display_letter + "</div>" +
				"</a>";
		}
		document.getElementById("browse-letters").innerHTML = letter_divs;
	}
}