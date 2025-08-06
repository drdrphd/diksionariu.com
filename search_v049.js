///
/// search.js
/// 
/// Methods: search(str, str) -- Prepares input for an SQL query
///				   	inputs are (query, language code)
///			 advSearch() -- executes a PHP query to the SQL database
///			 fuzzySearch(string) -- performs a fuzzy search via levenshtein(...)
///				levenshtein(string, string) -- returns a modified Levenshtein distance between 2 strings
///
/// Formatting Methods: (might move elsewhere)
///			 replaceMarkup(string) -- replace ''' (bold) and ~~ (italics) and [[...]] (links) with html tags
///					this must be done before highlighting is added, otherwise it may interere with links
///			 addHighlights(string, string) -- helper function, highlight a substring, adds HTML tags
///			 printDerivations(string, Array, Bool) -- formats the morphological derivations
///			 formatSingleResult(array) -- helper function to format a complete entry
///
///			 displayCHResults(str, JSON_array, (str)) -- deals with the returned values in a single-entry view
///			 displayCHAltResults(str, JSON_array) -- deals with returned results when main entry not found,
///					but found in 'related_forms' or 'see_also' (formatted like displayEngResults)
///			 displayCHPartialResults(str, JSON_array, JSON_array) -- no entry, but matches part of other entry
///			 displayEngResults(str, JSON_array) -- deals with the returned English results
///			 displayCHMultiple(int, JSON_array, bool) -- shows a page view of nearby results to a given entry
///			 displayAdvResults(JSON_array) -- inserts the results into the advanced page
///
/// For English searches, may try in the future to do a better ranked search
/// Currently returns results sorted by definition length,
///  where shorter definitions are assumed to be more relevant
/// Could try to sort by number of words instead or number of non- stop-words
/// Should rank results that use the search term more often higher (maybe by percent of length?)
///
/// Things to add:
///		Wildcards  (@ (vowel),# (consonant))
///		Search through stop-words first (things like "the") and present simple search results
///		
///	Add to advanced search:
///		Exact Search (literal with diacritics and - ' ) ?
///


/**************************/
/********* Search *********/
/**************************/

//
// Search
//
// Takes: a query (str) & language_code (str)
//
// Method: Do not accept empty queries
//		   Trim leading and trailing whitespace
// 		   Send to PHP (where it will be sanitized)
//
function search(str, lang) {
	
	str = str.trim();  //remove leading and trailing whitespace
	if (str.length < 1) return;		//blank search field, do not search
	if (str.includes(":")) lang = "Eng";	//If this is a compound definition search, search in English mode
	if (str.includes("::")) lang = "CH";	//however, if a compound example search, use CHamoru mode
	if (str.includes("~")) str = str.replaceAll("~","≈");	//replace ~ with visual approximation to avoid URL issues
	if (lang == "CH") {		//current lang codes are: CH, Eng
		window.location.href = encodeURIComponent(str);	
	} else {
		window.location.href = "search.php?q=" + encodeURIComponent(str) + "&lx=" + lang;
	}
}


//
// Advanced Search
//
// Takes: (no arguments -- values taken from page input boxes)
// Returns: array of queries, array of results
//
// Method: initiates PHP call and SQL query
//
function advSearch() {
		
	var str = "q="  + encodeURIComponent(document.getElementById("entry-text").value.trim()) +
			  "&a=" + encodeURIComponent(document.getElementById("alternate-forms").value.trim()) +
			  "&d=" + encodeURIComponent(document.getElementById("definition").value.trim()) +
			  "&e=" + encodeURIComponent(document.getElementById("examples").value.trim()) +
			  "&p=" + encodeURIComponent(document.getElementById("part-of-speech").value.trim()) +
			  "&o=" + encodeURIComponent(document.getElementById("origin").value.trim()) +
			  "&r=" + encodeURIComponent(document.getElementById("related-forms").value.trim()) +
			  "&c=" + encodeURIComponent(document.getElementById("see-also").value.trim()) +
			  "&n=" + encodeURIComponent(document.getElementById("notes").value.trim()) +
			  "&s=" + encodeURIComponent(document.getElementById("source").value.trim()) +
			  "&x=" + encodeURIComponent(document.getElementById("contextual-example").checked);
	
	if (str.length < 30) return;	//29 is length of: q=&a=&d=&e=&p=&o=&r=&c=&n=&s=
	
	//display a loading circle while fetching results
	document.getElementById("results").innerHTML = "<span class=\"loading\">Loading . . .</span>";

	if (window.XMLHttpRequest)  xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			displayAdvResults(this.responseText);
		}
	};			
	xmlhttp.open("GET","advsearch.php?" + str,true);
	xmlhttp.send();
}


//
// Fuzzy search
//
// fuzzySearch(string, JSON_array)
//
// Takes: search string (may contain '~')
//		  array of all entries and words from links [[..]] (lookup table)
// Returns: (string) a formatted list of close matches
// 			with links for new searches
//			and match strength bars
//
function fuzzySearch(str, word_list, long_list=false) {
	
	var results = [];
	var results_list = "";
	var list_length = (long_list ? 20 : 10);	//list length at 20 or 10 items (20 for direct fuzzy search ~)

	str = str.replaceAll("~","");		//strip out encoded ~ if included in search (fuzzy search shortcut wildcard)
	
	//word_list has format: ['lookup','field'], where 'field' can be 'entry' or 'non-entry'
	//we're going to bold any proper 'entry' in the list
	for (var i = 0; i < word_list.length; i++)
		if ( Math.abs(str.length - word_list[i].lookup.length) < 4)	//cut out some words by looking at words similar in length
			results.push( [levenshtein(word_list[i].lookup,str) , word_list[i].lookup, word_list[i].field ] );
	
	//sort descending by Levenstein ratio
	results.sort(function(a,b) {return a[0] > b[0] ? -1 : 1;} );
	
	for (var i = 0; i < Math.min(results.length, list_length); i++) {
		var lnk = encodeURIComponent(results[i][1]);
		if (results[i][2] == 'entry') { 	//if term is a proper 'entry'...
			lnk = "<a class='internal-link fuzzy-match-entry' href=\"" + lnk + "\">" + results[i][1] + "</a>"; 	//...mark in bold
		} else {
			lnk = "<a class='internal-link' href=\"" + lnk + "\">" + results[i][1] + "</a>"; 	//...mark in bold
		}
			
		results_list += "<div class='fuzzy-match'>"
						 + "<div class='match-strength'><div class='match-strength-bar' style='width:" + (5 * results[i][0]) + "em'></div></div>"
						 + lnk
						 + "<br />"
					  + "</div>";
	}
	
	if (long_list) {
		results_list = "<div class='fuzzy-container fuzzy-container-columns'>" + results_list + "</div>";
	} else {
		results_list = "<div class='fuzzy-container'>" + results_list + "</div>";
	}
	return (results_list);
}


//
// Levenshtein ratio (distance / length) (for CHamoru)
// Code adapted from: http://glench.github.io/fuzzyset.js/
//
// Helper function for fuzzySearch
// Calculates similarity between two strings,
// taking into account common spelling errors in CHamoru
//
// Takes: two strings
// Returns: a value on [0,1]
//			(1 - (scaling factor)*(Levenshtein distance / longer length))
//
function levenshtein(str1, str2) {
	var current = [], prev, value;
	
	//ignore glotta, replace 'ñ' with 'n', and reduce geminate consonants
	str1 = str1.replaceAll("'","").replaceAll("ñ","n").replace(/([BCDFGHKLMNPRSTYbcdfghklmnprsty])\1+/g, '$1').toLowerCase();
	str2 = str2.replaceAll("'","").replaceAll("ñ","n").replace(/([BCDFGHKLMNPRSTYbcdfghklmnprsty])\1+/g, '$1').toLowerCase();
	
	//method
	for (var i = 0; i <= str2.length; i++)
		for (var j = 0; j <= str1.length; j++) {
		if (i && j){
			var a = str1.charAt(i - 1);
			var b = str2.charAt(j - 1);
			var ab = [a,b];
			//same
			if (a === b) value = prev;
			//common CHamoru substitutions
			else if (ab.includes("a") && ab.includes("å")) value = prev + 0.1;
			else if (ab.includes("i") && ab.includes("e")) value = prev + 0.5;
			else if (ab.includes("i") && ab.includes("u")) value = prev + 0.5;
			else if (ab.includes("u") && ab.includes("o")) value = prev + 0.5;
			else if (ab.includes("e") && ab.includes("o")) value = prev + 0.5;
			else if (ab.includes("a") && ab.includes("e")) value = prev + 0.8;
			else if (ab.includes("a") && ab.includes("o")) value = prev + 0.8;
			else if (ab.includes("å") && ab.includes("o")) value = prev + 0.8;
			else if (ab.includes("l") && ab.includes("r")) value = prev + 0.8;
			else if (ab.includes("l") && ab.includes("t")) value = prev + 0.8;
			else if (ab.includes("r") && ab.includes("t")) value = prev + 0.8;
			else value = Math.min(current[j], current[j - 1], prev) + 1;	//deletion, substitution, insertion
		}
		else
			value = i + j;

		prev = current[j];
		current[j] = value;
		}
	
	//Levenshtein distance is a positive number (number of changes)
	//Here we take a ratio (1 / longer word)
	//But to make bigger better, take 1 - ratio
	//Small words with 1 change will look far worse than large words with 1 change, so scale by length (1  -  1/(.5 + length))
	return (1.0 - (1 - (1 / (.5 + Math.max(str1.length,str2.length)))) * (current.pop() / Math.max(str1.length,str2.length)));
}



/**************************/
/******* Formatting *******/
/**************************/

//
// replaceMarkup(string)
//
// helper function --
// Looks for templates {{...|...|...(...)}}
//  and swaps out with a query to the appropriate template
// Looks for '''...''' and ~~...~~ and [[...]] or [[...|...]]
//  replaces them with <b>...</b> and <i>...</i> and <a>...</a> tags
//
// *Must be done before adding highlighting (or may mess up links)
//
// returns a string (with html tags)
//
function replaceMarkup(str) {
	
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
					return "<a class='markup-link internal-link' href=\"" + encodeURIComponent(links[1].slice(0,-2)) + "\">" + links[0].slice(2) + "</a>";	//regex includes the starting and ending markup, so slice those out
				}
		    } else {
		        var lnk = encodeURIComponent(match.slice(2,-2));
		        return "<a class='markup-link internal-link' href=\"" + lnk + "\">" + match.slice(2, -2) + "</a>";	//regex includes the starting and ending markup, so slice those out
		    }
		}
	);
	
	//swap out {{...}} for template
	//(TODO - Eventually this should handle recursion -- templates in templates (see Wiktionary) )
	str = str.replace(/(\{\{[^\{]*\}\})/g,	//regex:  {{ + (anything that's not '{') + }}
		function(match) {
		    try {
				return dict_templates.swap(match.slice(2,-2));
			} catch (e) {
				console.error(e.message);
			}
		}
	);
	
	return str;
}


//
// addHighlights(string, string)
//
// Used when returning English and Advanced search
//  results to help show the search string
//
// helper function --
// Takes a results string and substring to highlight
// Adds html tag highlighting around the substring
// using custom (XML) <xx> tags
//
// *Markup must be replaced before adding highlighting (to avoid link errors)
// Strings will already include HTML tags
//
// returns a string (with html tags)
//
function addHighlights(str, substr) {
	
	//for compound searches
	if (substr.includes("::"))
		substr = substr.split("::")[1].trim();	//take the part after the colon, ignoring leading and trailing whitespace
	if (substr.includes(":"))
		substr = substr.split(":")[1].trim();	//take the part after the colon, ignoring leading and trailing whitespace
	
	//write a longer method later -- but for the moment if substring contains * ? ~, just return unaltered string
	if (substr.includes("*") || substr.includes("?") || substr.includes("~") ) return str;
	
	
	//This is a dicey approach -- RegEx is not a great tool for finding HTML tags -- TODO: move to DOM-based parsing
	//find HTML tags
	var regex = /<[^\<]*>/g;	//find:  < and whatever in between that doesn't have another < before a closing >
	//return an array of their positions and lengths in str
	var markup = [...str.matchAll(regex)];
	
	//get unmarked string and unmarked substring
	var temp = document.createElement("div");
	temp.innerHTML = str;
	temp = temp.innerText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");  //deaccent string to avoid diaritic errors
	substr = substr.normalize("NFD").replace(/[\u0300-\u036f]/g, "");  //deaccent string to avoid diaritic errors
	
	//search in the unmarked string for the search term (substring indices)
	var substring_indices = [...temp.toLowerCase().matchAll(new RegExp(substr.toLowerCase(), 'gi'))].map(a => [a.index, a.index + a[0].length]);
	
	//adjust the substring indices to account for trimmed markup
	for (var i = 0; i < markup.length; i++) {
		for (var j = 0; j < substring_indices.length; j++) {
			if (markup[i].index <= substring_indices[j][0]) {
				substring_indices[j][0] += markup[i][0].length;
			}
			if (markup[i].index <= substring_indices[j][1]) {
				substring_indices[j][1] += markup[i][0].length;
			}
		}
	}
	
	//insert the highlight tags at the new substring indices,
	//working from the end of the string to the beginning
	for (var i = substring_indices.length - 1; i > -1; i--) {
		str = str.substring(0,substring_indices[i][1]) 			//first part of the string un-highlighted
				+ "</xx>"											//closing tag
				+ str.substring(substring_indices[i][1], str.length);   //rest of the string
				
		str = str.substring(0,substring_indices[i][0]) 			//first part of the string un-highlighted
				+ "<xx class='highlight'>"	   						//opening tag
				+ str.substring(substring_indices[i][0], str.length);   //rest of the string
	}
	return str;
}


//
// printDerivations(String, Array [, Bool])
//
// Morphology - Print derivations for Popup
//
// Takes: query, parses array, and optional Bool for popup formatting
//   Parse format is : [word, {nested parse Object}, [linear parses] ]
// Returns: array [Bool, formatted HTML]
//		Bool: any parses?
//		HTML: unique parses from morphological stemming
//
function printDerivations(q, parses, popup=false) {
	
	var formatted = ""; //hold formatted HMTL to insert
	var terms = q.split(" ");	//get terms from query, as parse returns normed unaccented terms
	var a_open 		= (popup ? `<a class="markup-link popup-link" href="` : `<a class="markup-link internal-link" href="`);
	var a_open_root = (popup ? `<a class="markup-link popup-link root" href="` : `<a class="markup-link internal-link root" href="`);
	
	//check if all words come back empty
	var has_results = false;
	for (var p=0; p < parses.length; p++) {
		var word_parses = parses[p][2];
		if (word_parses.length > 0) {
			has_results = true;
		}
	}
	if (!has_results) {
		if (popup) {
			formatted = [false, "<div class='no-result'>Word not found</div>"];
		} else {
			formatted = [false, "<br /><br /><div class='no-result'>Word not found</div>"];
		}
		return formatted;
	}
	
	//otherwise, set up parses block
	if (popup)  formatted = "<i>Possible breakdowns:<br /><small>(*May contain errors)</small></i><br /><br />";  //what to add to the document
	
	//Parses might have more than one word for internal links
	//Parse format is : [word, {nested parse Object}, [linear parses] ], so we want parses[..][2]
	for (let p=0; p < parses.length; p++) {
		var word_parses = parses[p][2];
	
		//if no parse, show term with "Word not found"
		if (word_parses.length == 0) {
			formatted += "<h3>" + terms[p] + "</h3><br /><div class='no-result'>Word not found</div>";
			continue;
		}
		//otherwise, start a list of parses for the term
		if (popup) {
			formatted += "<h3>" + terms[p] + "</h3><ul>";
		} else {
			formatted += "<h4>" + terms[p] + "</h4><ul>";
		}
		
		var unique_parses = []; //filter for only unique parses
		for (var i=0; i < word_parses.length; i++) {
			let temp_deriv = "<li>";
			for (var k=0; k < word_parses[i].length; k++) {
				m = word_parses[i][k];	//current morpheme
				if (m.morpheme_text == "(Vowel<br>Fronting)") {
					temp_deriv += "<span class='morph'>(Vowel Fronting)</span> + ";
				} else if (m.morpheme_value.includes("~")) {	//reduplication -- process, not dict entry, don't link
					temp_deriv += "<span class='morph reduplication'>"
						+ m.morpheme_value + "</span>.";
				} else if (m.morpheme_type == "ROOT") {		//Root morphemes are bold
					temp_deriv += a_open_root
						+ encodeURIComponent(m.morpheme_value) + `">`
						+ m.morpheme_value + `</a>.`;
				} else {	//non-roots
					if (m.morpheme_value == "&lt;in&gt;") {	//<in> infix: in dict as -in-
						temp_deriv += a_open
							+ encodeURIComponent("-in-") + `">`
							+ m.morpheme_value + `</a>.`;
					} else if (m.morpheme_value == "&lt;um&gt;") {	//<um> infix: in dict as -um-
						temp_deriv += a_open
							+ encodeURIComponent("-um-") + `">`
							+ m.morpheme_value + `</a>.`;
					} else if (m.morpheme_type == "PFX" || m.morpheme_type == "CFXPFX") {	//Prefixes, add - after morpheme
						temp_deriv += a_open
							+ encodeURIComponent(m.morpheme_value + "-") + `">`
							+ m.morpheme_value + `</a>.`;
					} else if (m.morpheme_type == "SFX" || m.morpheme_type == "CFXSFX") {	//Suffixes, add - before morpheme
						temp_deriv += a_open
							+ encodeURIComponent("-" + m.morpheme_value) + `">`
							+ m.morpheme_value + `</a>.`;
					} else {	//everything else ... shouldn't get here, but just in case
						temp_deriv += a_open
							+ encodeURIComponent(m.morpheme_value) + `">`
							+ m.morpheme_value + `</a>.`;
					}
				}
			}
			temp_deriv = temp_deriv.slice(0,-1);	//remove final "."
			temp_deriv += "</li>";
			if (!unique_parses.includes(temp_deriv))  unique_parses.push(temp_deriv);
		}
		
		for (var i of unique_parses)  formatted += i;
		formatted += "</ul>";
	}
	return [true, formatted];
}


//
// formatSingleResult(array, (boolean))
//
// helper function --
// Formats a single result vector for display
//
// optional boolean parameter for Word of the Day
//   (no header: Entry word formatted separately
// 				 No Link to browse in context)
// 
// returns a string (with html tags)
//
function formatSingleResult(res, header=true) {
	
	var show_CNMI_entry = "",
		show_alternate_forms = "",
		show_origin = "",
		show_pos = "",
		show_definition = "",
		show_examples = "",
		show_notes = "",
		show_related_forms = "",
		show_see_also = "",
		show_source = "",
		show_context = "";
	var show_minor_content = "";	//for spacer formatting
	
	//*** fix this later -- onclick not preferred, but harder to implement otherwise (async assign EventListener after HTML inserted)
	var context_expander = "<zz id='context-" + res.hashed_entry + "' class='context-expander'>"
		+ "<a onclick='getContextualExamples(\"context-" + res.hashed_entry + "\",[" + res.context_examples + "])'>[▼ Show]</a></zz>";
		
	//example formatting - if not a template, add <li> formatting
	if(res.examples.length > 0 && res.examples.slice(0,2) != "{{") res.examples = "<ul><li><i>" + res.examples + "</i></li></ul>";
	
	if(res.CNMI_entry.length > 0)		{show_CNMI_entry 		= "<h3>CNMI Spelling:</h3>" 	+ "<zz>" + res.CNMI_entry + "</zz>";}
	if(res.alternate_forms.length > 0)	{show_alternate_forms 	= "<h3>Alternate Forms:</h3>" 	+ "<zz>" + res.alternate_forms + "</zz>";}
	if(res.origin.length > 0)			{show_origin 			= "<h3>Origin:</h3>" 			+ "<zz>" + res.origin + "</zz>";}
	if(res.part_of_speech.length > 0)	{show_pos 				= "<h3 class='part-of-speech'>" + res.part_of_speech + "</h3>";}
	if(res.definition.length > 0)		{show_definition 		= 	"<zz>" + res.definition + "</zz>";}
	if(res.examples.length > 0)			{show_examples 			= 	"<zz>" + res.examples 	+ "</zz>";}
	if(res.notes.length > 0)			{show_notes 			= "<h3>Notes:</h3>" 			+ "<zz>" + res.notes + "</zz>";}
	if(res.related_forms.length > 0)	{show_related_forms 	= "<h3>Related Forms:</h3>" 	+ "<zz>" + res.related_forms + "</zz>";}
	if(res.see_also.length > 0)			{show_see_also 			= "<h3>See Also:</h3>" 			+ "<zz>" + res.see_also + "</zz>";}
	if(res.source.length > 0)			{show_source 			= "<h3>Source:</h3>" 			+ "<zz>" + res.source + "</zz>";}
	if(res.context_examples.length > 0)	{show_context			= "<br /><br /><h3>Examples In Context:</h3>" + context_expander;}
	
	//add a minor-content div if any of the following fields exist
	if(show_CNMI_entry.length > 0 || show_alternate_forms.length > 0 || show_origin.length > 0 || show_notes.length > 0
		|| show_related_forms.length > 0 || show_see_also.length > 0 || show_source.length > 0) {
		show_minor_content = 
			"<div class='content minor-content'>" +
				show_CNMI_entry + 
				show_alternate_forms +
				show_origin +
				show_notes +
				show_related_forms +
				show_see_also +
				show_source +
				show_context +
			"</div>";
	}
	
	
	//assemble the entry
	var formatted_result = "";
	if (header) {
		formatted_result += 
		"<div class='entry'>" +
			"<a href='search.php?i=" + res.index_num + "&e=" + res.hashed_entry + "&h=1'><div class='results-multiple-button'></div></a>" +
			"<a class='history-link' href='history.php?id=" + res.id_immutable + "'><div class='history-button'></div></a>" +
			"<h1>" + res.entry + "</h1>";
	}
	formatted_result +=
			"<div class='content'>" +
				show_pos +
				  show_definition +
					show_examples +
			"</div>" +
			show_minor_content +
		"</br></div>";
		
	//swap out markup for html tags
	formatted_result = replaceMarkup(formatted_result);
		
	return formatted_result;
}



/***************************/
/***** Display Results *****/
/***************************/

//
// Display CHamoru Results
//
// displayCHResults(str, JSON_array, (str), (JSON_array))
//		first str = the search query
//		first JSON_array = search results
//		second str = optional initial message passed from other functions (like redirect messages)
//		second JSON_array = array of 'entry','alternate_forms','related_forms','see_also' for fuzzy search
//
// Description:
//	  Looks in 'entry' and 'alternate_forms' fields for search query
//
//	  Show the retrieved results with a button for multiple-entry-view
//	  If no results - show No Results
//	  If there are wildcards, show how many results were found and then show the results
//	  Otheriwse, show results, starting with exact matches
//
function displayCHResults(q, results, message = "", all_words = [], type = "") {
	
	// helper function to deaccent text and remove ' -
	function norm(str) {
		str = str.normalize("NFD").replace(/[\u0300-\u036f'\-]/g, "");  // NFD : Canonical Unicode Decomposition
		str = str.toLowerCase();
		return str;
	}
	
	
	// Hold formatted results	
	var formatted_results = "" + message;
	
	// If SQL returns "0" (entry not found)
	if (results == "0") {
		
		// For Compound Search, don't fuzzy search
		if (q.includes("::") && (message == "")) {
			formatted_results = 
				"<h2>" + q + "</h2>" +
				"<p class='no-result'>Entry not found</p></br>";

		// Otherwise, run fuzzy search
		} else if ((message == "") && (type == "")) {
			formatted_results = 
				"<h2>" + q + "</h2>" +
				"<p class='no-result'>Entry not found</p></br>" +
				"<h3>Did you mean: </h3>" + fuzzySearch(q, all_words);
		
		// For Direct morph search (returns type: "parse")
		} else if (type == "parse") {
			q = q.replaceAll("#","");	// remove #
			var deriv = printDerivations(q, parse(q));
			formatted_results += "<div class='morph-container'><h2 class='morph-message'>Possible breakdowns</h2><small><i>(*In testing -- May contain errors)</i></small>"
								+ deriv[1]
								+ "</div>";
		
		// For Direct fuzzy search (returns type: "fuzzy")
		} else if (type == "fuzzy") {
			formatted_results += "<h2>Near matches: <i>"
								+ q
								+ "</i></h2>"
								+ fuzzySearch(q, all_words, true);
		}
	}
	
	// Results found
	if (results != "0") {
		
		// add highlighting to examples for compound example search "::"
		if (q.includes("::")) {
			//highlight the search terms in the results
			for (var i = 0; i < results.length; i++)   results[i].examples   = addHighlights(results[i].examples, q);
		}
		
		// Check for wildcard searches
		if (q.indexOf("*") > -1 || q.indexOf("?") > -1) {
			
			// display results starting with total number of hits found...
			formatted_results = "<div><h2>" + results.length + " results found</h2></div>";
			
			// build HTML and attach to results
			for (var i = 0; i < results.length; i++) {
				formatted_results += formatSingleResult(results[i]);
			}
		
		// Non-wildcard, display results, starting with exact matches to search string
		} else {
			
			// if there is only one result...
			// replace the <title> tag with the search-result spelling
			if (results.length == 1) {
				document.getElementsByTagName("title")[0].innerHTML = results[0].entry + " - Diksionårion CHamoru";
			}
			
			// Redirect message for single Alternate Forms results
			if ((results.length == 1) && (results[0].alternate_forms.includes("[[" + q + "]]")) ) {
				formatted_results = "<zz class='redirect-text'>(Redirected from <a href='" + q + "'>" + q + ")</a></zz>";
				formatted_results += formatSingleResult(results[0]);
			
			
			// If not just one Alternate Form result...
			} else {
			
				// We will be re-sorting the results
				// Exact results first
				res_exact = [], res_close = [], res_alts  = [];
				for (var i of results) {
					if (i.entry == q) {
						res_exact.push(i);
					} else if (norm(i.entry) == norm(q)) {
						res_close.push(i);
					} else if (norm(i.alternate_forms).includes("[[" + norm(q) + "]]")) {
						res_alts.push(i);
					}
				}

				// build HTML for each entry and attach to the results section
				// display exact matches first, then close orthographic matches, then alternate forms
				if (res_exact.length > 0) {
					for (var i = 0; i < res_exact.length; i++) {
						formatted_results += formatSingleResult(res_exact[i]);
					}
				} else {
					formatted_results = "<h2>" + q + "</h2>" + "<p class='no-result'>Entry not found</p><br /><br />";
				}
				if (res_alts.length > 0) {
					formatted_results += "<h3 class='close-match-header'>Alternate Form matches:</h3>";
					for (var i = 0; i < res_alts.length; i++) {
						formatted_results += formatSingleResult(res_alts[i]);
					}
				}
				if (res_close.length > 0) {
					formatted_results += "<h3 class='close-match-header'>Close orthographic matches:</h3>";
					for (var i = 0; i < res_close.length; i++) {
						formatted_results += formatSingleResult(res_close[i]);
					}
				}
			}
		}
	}
	
	//display the formatted results in the 'results' section
	formatted_results = "<div class='results-single'>" + formatted_results + "</div>";
	document.getElementById("results").innerHTML = formatted_results;
}


//
// Display Alternate CHamoru Results
//
// displayCHAltResults(str, JSON_array)
//		str = the search query
//		JSON_array = search results
// 
// Use:
//	  When search query doesn't find a main entry,
//	  but finds it 'related_forms' or 'see_also'
//
// Takes:
//	  an object of results from the SQL query
// Returns:
//	  --
// Method:
// 	  Does some organizing -- display is like displayEngResults
//    Inserts into "results" div
//
// *Includes highlighting
//
function displayCHAltResults(str, results) {
	
	//We will be re-sorting the results
	//Exact results first
	var temp_related = [];
	var temp_also = [];

	//Check for wildcard searches
	//If there are no wildcards, reorder the entries, starting with Alternate Forms,
	//then Related Forms and See Also
	//
	//if no wildcards
	if (!(str.indexOf("*") > -1 || str.indexOf("?") > -1)) {
		//reorder entries...
		for (var i = 0; i < results.length; i++) {
			if (results[i].related_forms.includes(str)) {
				temp_related.push(results[i]);
			} else {
				temp_also.push(results[i]);
			}
		}
		//and reassemble into results
		results = temp_related.concat(temp_also);
	}
	
	
	//Add "not found" message (and if not a compound search, offer Fuzzy Search link)
	var formatted_results = "<h2>" + str + "</h2>" +
			"<p class='no-result'>Entry not found</p>";
	if (!str.includes(":"))
		formatted_results += "<p class='no-result'><a class='no-result-link' href=\"" + encodeURIComponent(str + "≈") + "\">Try fuzzy search? " + str + "~</a><br /><br /></p>";
	
	
	//display results starting with total number of hits found...
	formatted_results += "<div><h3>" + results.length + " results in other entries</h3></div>";
	
	//handle markup: remove ''' ... ''' (leave ~~italics~~ and [[links]])	<- [[.|.]] links are problematic
	//(for alternate results, we just trim it out)
	for (var i = 0; i < results.length; i++) {
		results[i].related_forms 	= replaceMarkup(results[i].related_forms	.replaceAll("'''",""));
		results[i].see_also			= replaceMarkup(results[i].see_also			.replaceAll("'''",""));
		results[i].definition 		= replaceMarkup(results[i].definition);
	}
	
	//highlight the search terms in the results
	for (var i = 0; i < results.length; i++) {
		results[i].related_forms   = addHighlights(results[i].related_forms,   str);
		results[i].see_also		   = addHighlights(results[i].see_also,		   str);
	}
	
	for (var i = 0; i < results.length; i++) {
		
		var show_alternate_forms = "",
			show_related_forms = "",
			show_see_also = "";
		
		if (results[i].alternate_forms.length > 0)	{show_alternate_forms = "<p><b>Alternate Forms: </b>" + results[i].alternate_forms + "</p>";}
		if (results[i].related_forms.length > 0)	{show_related_forms   = "<p><b>Related Forms: </b>"   + results[i].related_forms   + "</p>";}
		if (results[i].see_also.length > 0)			{show_see_also		  = "<p><b>See Also: </b>"		  + results[i].see_also		   + "</p>";}

		formatted_results += 
			"<div class='results-english'>" +
				"<a href='search.php?i=" + results[i].index_num + "&e=" + results[i].hashed_entry + "&h=1'><div class='results-multiple-button'></div></a>" +
				"<a class='history-link' href='history.php?id=" + results[i].id_immutable + "'><div class='history-button'></div></a>" +
				"<h3><a href=\"" + encodeURIComponent(results[i].entry) + "\">" + results[i].entry + "</a></h3>" +
				"<p><b>Part of Speech:</b> " + results[i].part_of_speech + "</p>" +
				"<p><b>Definition:</b> " + results[i].definition + "</p>" +
				show_alternate_forms +
				show_related_forms +
				show_see_also +
			"</div>";
	}
	
	//insert into document
	document.getElementById("results").innerHTML = "<div class='results-single'>" + formatted_results + "</div>";
}


//
// Display CHamoru Partial Matches
//
// displayCHPartialResults(str, JSON_array, JSON_array)
//	  str = query
//	  first  JSON_array = SQL results
//	  second JSON_array = lookup table (all words and t/f main entry)
//		
// Description:
//	  Results return no exact entry match, but query matches part of an entry
// Returns:
//	  --
// Method:
// 	  Does some organizing -- display is like displayCHAltResults
//	  Inserts into "results" div
//
// *Includes highlighting
//
function displayCHPartialResults(str, results, all_words) {
	
	var formatted_results = "<h2>" + str + "</h2>"
						  + "<p class='no-result'>Entry not found</p><br />";
	
	//display results starting with total number of hits found...
	formatted_results += "<div class='partial-container'>"
							+ "<div class='partial-subcontainer'>"
								+ "<h3>Partial matches</h3>"
								+ "<div class='partial-results'>";
	
	//sort results by length similarity to search string
	results.sort((a,b) => Math.abs(a.entry.length - str.length) - Math.abs(b.entry.length - str.length));
	
	//form links and highlight the search terms
	for (var i = 0; i < Math.min(results.length, 10); i++) {
		var highlighted = "";
		if (results[i].entry.length > str.length) {
			highlighted = addHighlights(results[i].entry, str);
		} else { 
			highlighted = results[i].entry;
		}
		
		formatted_results += "<div class='partial-match'>"
								+ "• <a class='internal-link' href=\"" + encodeURIComponent(results[i].entry) + "\">"
									+ highlighted
								+ "</a></div>";
	}
	
	if (results.length > 10) {
		formatted_results += "<div class='partial-match'>"
								+ "<a href=\"" + encodeURIComponent("*" + str + "*") + "\">" + "See more..." + "</a>"
							+ "</div>";
	}
	
	formatted_results += "</div>"; //close the sub-container
	
	//check for morphological breakdowns
	var deriv = printDerivations(str, parse(str));
	if (deriv[0]) {	//if there are morphological derivations, include them
		formatted_results += "<br /><div class='partial-subcontainer'>"
								+ "<h3 class='morph-message'>Possible breakdowns</h3><small><i>(*Ignores punctuation -- May contain errors)</i></small>"
								+ "<div class='morph-container'>" + deriv[1] + "</div></div>";
	}
	
	//add Fuzzy Search
	formatted_results += "</div><div class='partial-subcontainer'><h3>Or did you mean: </h3>" + fuzzySearch(str, all_words) + "</div></div>";
	
	//insert into document
	document.getElementById("results").innerHTML = "<div class='results-single'>" + formatted_results + "</div>";
}



//
// Display English Results
//
// displayEngResults(str, JSON_array)
//
// Takes:
//	  query, and an object of results from the SQL query
// Returns:
//	  --
// Method:
//	  Does some organizing
//	  Moves results that contain the query as a whole first
//	  Displays embedded queries or disjointed queries next
//
//	  For searches that have spaces, searches:
//		Exact phrase first, then conjunction search (__ AND __ AND ...)
//
// *Includes highlighting
//
// TODO: also update to put results with greater percent use search term per definition
// TODO: also update to include reverse lookup first
//
function displayEngResults(str, results) {
	
	var formatted_results = "";
	
	//We will be re-sorting the objects (which are returned in order of length of definition, shortest first)
	//We want any definitions that include the isolated search string to come up first
	//Thus, for 'fun':  " fun ", ##"fun ", " fun"##, " fun,", " fun.", etc.
	var temp_exact = [];
	var temp_partial = [];
	
	//SQL returns a "0" if search finds nothing
	if (results == "0") {
		document.getElementById("results").innerHTML = 
			"<h2>" + str + "</h2>" +
			"<p class='no-result'>No results found</p>";

		//for non-compound searches, offer to repeat in CHamoru
		if (!str.includes(":")) {
			document.getElementById("results").innerHTML += 
				"<p class='no-result'><a class='no-result-link' href=\"" + encodeURIComponent(str) + "\">Repeat search in CHamoru?</a></p>";
		}

	} else {
		
		var punctuation = [" ", ",", ".", "?", "!", ";", ":", "-", "(", ")"];		//(probably a better way to do this with character ranges)
		
		//separate out the results into the two temp arrays
		for (var i = 0; i < results.length; i++) {
			
			var substring_index = results[i].definition.toLowerCase().indexOf(str.toLowerCase());
			
			//Ordering of search results by relevance
			//exact result first
			if ( results[i].definition.length == str.length ) { 	//if search string and definition are the same...
				temp_exact.push(i); 	//add the results index
			//left edge next...
			} else if ( substring_index == 0 	//check if searh string is at left edge...
						&& results[i].definition.length > str.length		//and if there's additional characters after...
						&& punctuation.includes( results[i].definition[str.length]) ) { 	//and the next character after the search term is in the punctuation array...
				temp_exact.push(i); 	//add the results index
			//right edge next...
			} else if ( substring_index > 0		//if substring exists and there's characters before it...
						&& results[i].definition.length == (substring_index + str.length)	//and search string is at right edge...
						&& punctuation.includes( results[i].definition[substring_index -1]) ) { //and the character before the search term is in the punctuation array...
				temp_exact.push(i); 	//add the results index
			//middle cases...
			} else if ( substring_index > 0		//if substring exists and there's characters before...
						&& results[i].definition.length > str.length		//and after...
						&& punctuation.includes(results[i].definition[substring_index -1])	//and the character before is in punctuation array...
						&& punctuation.includes(results[i].definition[substring_index + str.length]) ) {		//as well as the character after...
				temp_exact.push(i); 	//add the results index
			//otherwise (if there's characters next to the search string)...
			} else {
				temp_partial.push(i);		//add the results index to the other array
			}
		}
		
		//markup - remove ''' ... '''  and  ~~ ... ~~
		//replace [[...]] with <a>..</a> HTML tags
		for (var i = 0; i < temp_exact.length; i++) {
			results[temp_exact[i]].definition =
				replaceMarkup(
					results[temp_exact[i]].definition
						.replaceAll("'''","")
						.replaceAll("~~",""));}
		for (var i = 0; i < temp_partial.length; i++) {
			results[temp_partial[i]].definition =
				replaceMarkup(
					results[temp_partial[i]].definition
						.replaceAll("'''","")
						.replaceAll("~~",""));}
		
		//highlight the search terms in the results
		for (var i = 0; i < temp_exact.length; i++)   results[temp_exact[i]].definition   = addHighlights(results[temp_exact[i]].definition, str);
		for (var i = 0; i < temp_partial.length; i++) results[temp_partial[i]].definition = addHighlights(results[temp_partial[i]].definition, str);
		
		//display results starting with total number of hits found...
		formatted_results = "<div><h2>" + results.length + " results found</h2></div>";
		
		//exact results first
		for (var j = 0; j < temp_exact.length; j++) {
			
			var i = temp_exact[j]; //get the current index from the above array

			formatted_results += 
				"<div class='results-english'>" +
					"<a href='search.php?i=" + results[i].index_num + "&e=" + results[i].hashed_entry + "&h=1'><div class='results-multiple-button'></div></a>" +
					"<a class='history-link' href='history.php?id=" + results[i].id_immutable + "'><div class='history-button'></div></a>" +
					"<h3><a href=\"" + encodeURIComponent(results[i].entry) + "\">" + results[i].entry + "</a></h3>" +
					"<p><b>Part of Speech:</b> " + results[i].part_of_speech + "</p>" +
					"<p><b>Definition:</b> " + results[i].definition + "</p>" +
				"</div>";
		}
		
		//partial matches next
		for (var j = 0; j < temp_partial.length; j++) {
			
			var i = temp_partial[j]; //get the current index from the above array
			
			formatted_results += 
				"<div class='results-english'>" +
					"<a href='search.php?i=" + results[i].index_num + "&e=" + results[i].hashed_entry + "&h=1'><div class='results-multiple-button'></div></a>" +
					"<a class='history-link' href='history.php?id=" + results[i].id_immutable + "'><div class='history-button'></div></a>" +
					"<h3><a href=\"" + encodeURIComponent(results[i].entry) + "\">" + results[i].entry + "</a></h3>" +
					"<p><b>Part of Speech:</b> " + results[i].part_of_speech + "</p>" +
					"<p><b>Definition:</b> " + results[i].definition + "</p>" +
				"</div>";
		}
		
		//insert into document
		document.getElementById("results").innerHTML = "<div class='results-single'>" + formatted_results + "</div>";
	}
}



//
// Display Multiple CHamoru Results
//
// displayCHMultiple(numeric, JSON_array, bool)
//		numeric -- int of starting index
//		JSON_array -- results from SQL query
//		bool -- whether to highlight or not
//
// Description:
//	  After clicking on the book icon next to an entry, shifts to a multiple result view
//	  Gets the ~20 surrounding entries (by index) (might later allow custom number via global setting)
//	  and presents them in a 2-column book format
//	  Clicking on an individual entry in this view will go to the individual view
//	  Big Letters at the beginning of a section are also inserted via (const letter_indexes) from search.php
// Returns:
//	  --  (inserts into "results" div)
//
function displayCHMultiple(CH_index, results, highlight) {

	var dictionary_page_header = "";
	var formatted_results = "";
	var entry_class = "";
	var nav_earlier_index = 1;
	var big_letter = "";
	
	//SQL returns a "0" if entry not found -- THIS SHOULD NEVER HAPPEN HERE, but include for now for debugging
	if (results == "0") {
		document.getElementById("results").innerHTML = 
			"<h2>" + str + "</h2>" +
			"<p class='no-result'>Entry not found</p></br>";
			
	} else {
		
		//create the page header that goes:    fino'  -----------  flamosa 
		//when mousing over either of those entries, should get an arrow
		if (results[0].index_num > 18) {    //****************************************SHOULD NOT HARD CODE THIS******* (18, because this gets a window of 2 before and 18 after query)
			nav_earlier_index = results[0].index_num - 18;
		}
		
		dictionary_page_header += 
			"<div class='results-multiple-header'>" +
				"<a href='search.php?i=" + nav_earlier_index + "&h=0'><div class='results-multiple-nav results-multiple-nav-earlier'>" +
					results[0].entry +
				"</div></a>" + 
				"<div class='results-multiple-nav-middle'> </div>" +
				"<a href='search.php?i=" + (+results[results.length-1].index_num + 2) + "&h=0'><div class='results-multiple-nav results-multiple-nav-later'>" +
					results[results.length-1].entry +
				"</div></a>" +
			"</div>";	
		
		
		//build the HTML for each entry and attach to the results section
		for (var i = 0; i < results.length; i++) {
			
			//Big Caps
			//Go through indexes and if the current result index matches one of those, stick in a Big Letter
			for(var j = 0; j < letter_indexes.length; j++) {
				if(results[i].index_num == letter_indexes[j].start_index) {
					big_letter = letter_indexes[j].letter.toUpperCase();
					big_letter = big_letter.normalize("NFD").replace(/[\u0300-\u036f'\-]/g, "");  //NFD : Canonical Unicode Decomposition  (de-accent)
					
					if 		  (big_letter == "A") { big_letter = "Aa Åå";
					} else if (big_letter == "C") { big_letter = "CH&ThinSpace;ch";
					} else if (big_letter == "N") { big_letter = "Nn Ññ NG&ThinSpace;ng";
					} else { big_letter += big_letter.toLowerCase(); }
					
					formatted_results += "<div class='results-multiple-big-letter'>" + big_letter + "</div></br>"
				}
			}
			
			
			if(+highlight > 0 && results[i].index_num == CH_index) {
				entry_class = "results-multiple-entry results-multiple-original-entry";
			} else {
				entry_class = "results-multiple-entry";
			}
			formatted_results += 
				"<a href=\"" + encodeURIComponent(results[i].entry) + "\">" +
					"<div class='" + entry_class + "'>" +
						"<xx class='xx-term'>" + results[i].entry + "</xx> – " + 
						"<xx class='xx-POS'>" + results[i].part_of_speech + ". </xx> " +
						"<xx class='xx-definition'>" + results[i].definition + " </xx>" +
						"<xx class='xx-examples'>" + results[i].examples +
					"</div>" +
				"</a></br>";
		}
		
		//cut out markup: ''' ... '''   and  [[...]]   (leave italics ~~)
		formatted_results = formatted_results.replaceAll("'''","");
		formatted_results = formatted_results.replace(/(\[\[[^\[]*\]\])/g,	//regex:  [[ + (anything that's not '[') + ]]
			function(match) {
				if (match.includes('|')) {
					return match.split('|')[0].slice(2);	//take only stuff before '|' and after '[['
				} else {
					return match.slice(2,-2);
				}
			}
		);
		formatted_results = replaceMarkup(formatted_results);
		
		document.getElementById("results").innerHTML = dictionary_page_header + "<div class='results-multiple'>" + formatted_results + "</div>";
	}
}



//
// Display Advanced Results
//
// displayAdvResults(JSON_array)
//		JSON_array = results object from SQL
//
// Description:
//	  Format the results returned by the "Advanced" tab
//
//	  Show the retrieved results with a button for multiple-entry-view
//	  If no results - show No Results
//	  Otherwise, show how many results were found and then show the results
// Returns:
//	  --  (inserts formatted text into "results" div)
//
// *Includes highlighting
//
function displayAdvResults(results) {
	
	var formatted_results = "";
	
	//SQL returns a "0" if entry not found -- easier for debugging, can see that something was returned
	if (results == "0") {
		formatted_results = "<p class='no-result'>No results</p></br>";
	
	} else {
		queries = JSON.parse(results.split("¶")[0]); //delimited by ¶ (hopefully not in database!)
		results = JSON.parse(results.split("¶")[1]); //overwrite once split
		
		//display results starting with total number of hits found...
		formatted_results = "<div><h2>" + results.length + " results found</h2></div>";
		
		for (var i = 0; i < results.length; i++) {
			if(queries.q.length > 0)				results[i].entry 			= addHighlights( 			   results[i].entry, 			queries.q);
			if(queries.alternate_forms.length > 0)	results[i].alternate_forms 	= addHighlights( replaceMarkup(results[i].alternate_forms),	queries.alternate_forms);
			if(queries.definition.length > 0)		results[i].definition 		= addHighlights( replaceMarkup(results[i].definition), 		queries.definition);
			if(queries.examples.length > 0)			results[i].examples 		= addHighlights( replaceMarkup(results[i].examples), 		queries.examples);
			if(queries.notes.length > 0)			results[i].notes 			= addHighlights( replaceMarkup(results[i].notes), 			queries.notes);
			if(queries.origin.length > 0)			results[i].origin 			= addHighlights( replaceMarkup(results[i].origin), 			queries.origin);
			if(queries.part_of_speech.length > 0)	results[i].part_of_speech 	= addHighlights( 			   results[i].part_of_speech, 	queries.part_of_speech);
			if(queries.related_forms.length > 0)	results[i].related_forms 	= addHighlights( replaceMarkup(results[i].related_forms), 	queries.related_forms);
			if(queries.see_also.length > 0)			results[i].see_also 		= addHighlights( replaceMarkup(results[i].see_also), 		queries.see_also);
			if(queries.source.length > 0)			results[i].source 			= addHighlights( replaceMarkup(results[i].source), 			queries.source);
			
			formatted_results += formatSingleResult(results[i]);
		}

		
		//display the formatted results in the 'results' section
		formatted_results = "<div class='results-single'>" + formatted_results + "</div>";
	}
	
	document.getElementById("results").innerHTML = formatted_results;
	document.getElementById("source").scrollIntoView({ behavior: "smooth"});
}



//
// Display Error (from PHP fetch)
//
function displayError(err) {
	document.getElementById("results").innerHTML = "<div class='no-result'>Not able to connect to database: </br>" + err + "</div>";
}