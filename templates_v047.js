///
/// templates.js
/// 
/// Constants: dict_templates -- object that holds the templates
///			In the future, replace with an SQL system of retrieving templates
///
/// Methods:
///			swap(Object) -- takes the extracted text from within a template {{...}}
///							redirects to a template, returns formatted HTML
///
///	Template Methods:
///
///			(General format) -- {{name_of_template||...||...||...}}
///
///			Line break -- {{}}		<-- empty template
///			Bulleted examples -- {{||example_CH|example_EN||...}}	<-- empty template name (SQL searches over the 'examples' field; 
///																			possible interactions with words here (searching 'ex'
///																			would return all examples rather than examples with 'ex' in them))
///			Bulleted list -- {{list||word|meaning||...}}
///					in the future, hopefully -- {{ex||example_CH|example_EN|morph|source||...}}
///			Selected Affixed forms -- {{sel_aff||aff|word|meaning|example_CH|example_EN||...}}
///

// Global object (accessible in other .js files)
const dict_templates = {

	//
	// swap(Object)
	//
	// Takes: inner text extracted from a template {{...}}
	//
	// Method:  extracts the template name (if any)
	//			parses the text from ||...|...|...||...|...|...
	//			into [[...,...,...],[...,...,...],...]
	//			accesses templates (below)
	//			forwards results
	//
	// Returns: formatted HTML
	//
	swap: function(template_text) {
		//check for {{}} first (empty template)
		if (template_text.length == 0) return dict_templates.lineBreak();

		//otherwise, turn text into array, and then split those into sub-arrays
		//TODO -- probably some form of validation or checking here!!!
		template_text = template_text.replaceAll("||","§");
		var template_array = template_text.split("§"); //parse text into an array and store here
		var template_name = template_array.shift(); //pop-off first element as template name

		//check for {{||.... (empty template name)
		if (template_name.length == 0) template_name = "examples";
		
		//split array into sub-arrays by |
		for (var i = 0; i < template_array.length; i++) {
			template_array[i] = template_array[i].replaceAll("|","§");
			template_array[i] = template_array[i].split("§");
		}
		
		//check for template, throw error if DNE
		if (this[template_name]) {
			return this[template_name](template_array);
		} else {
			throw new Error('Template not found: ' + template_name);
		}
	},


	//***********************//
	//****   Templates   ****//
	//***********************//

	//Line Break
	lineBreak: function() {
		return "<br />";
	},
	
	//Bulleted list
	list: function(arr) {
		//TODO - error checking
		var t = "";
		for (var i = 0; i < arr.length; i++) {
			t += "<li>" + arr[i][0];
			if (arr[i].length > 1) t += " (" + arr[i][1] + ")";
			t += "</li>";
		}
		return t;
	},
	
	//Bulleted examples
	examples: function(arr) {
		//TODO - error checking
		var t = "";
		for (var i = 0; i < arr.length; i++) {
			var n = document.createElement('div'); 	//create new DOM node for identifying HTML elements and wrapping text only
			n.innerHTML = arr[i][0];
			n = wrapWordsCHExamples(n);
			
			t += "<div class='ex-ch'>" + n.innerHTML + "</div>";
			if (arr[i].length > 1) t += "<div class='ex-eng'>" + arr[i][1] + "</div>";
		}
		return t;
	}
};


// I DON'T WANT TO PUT THIS HERE
// (templates should be templates only)
// BUT IT SEEMS THE BEST FUNCTIONAL PLACE
//
// wrapWordsCHExamples(element)
//
// helper function --
// Takes a DOM Node
// Wraps each text element in a <span> tag for hover pop-ups
// Recurses on other node types for embedded text nodes
//
function wrapWordsCHExamples(e) { //DOM Element
	
	if (e.tagName === "A") return e;	//don't process links -- they're already formatted
	
	var frag = document.createDocumentFragment();
	var text_frag = document.createDocumentFragment();
	var ch = e.childNodes;
	
	//modifying the elements can alter collection, so iterate in reverse
	for (var n = ch.length -1; n > -1; n--) {
		if (ch[n].nodeType === 3) {  //nodeType of 3 == TEXT_NODE
			var words = ch[n].data.split(" ");
			//wrap each text node in spans
			for (var i=0, len2 = words.length; i < len2; i++) {
				var s = document.createElement("span");
				s.className = 'example internal-link';
				s.textContent = words[i];
				text_frag.appendChild(s);
				if (i < len2 - 1) 
					text_frag.appendChild(document.createTextNode(' '));	//for non-final elements, add space between
			}
			frag.insertBefore(text_frag, frag.firstChild);
		} else { //for other node types, recurse for embedded text nodes
			frag.insertBefore(wrapWordsCHExamples(ch[n]), frag.firstChild);
		}
	}
	e.innerHTML = "";	//clear old contents
	e.appendChild(frag);	//swap in newly formatted contents	
	return e;
}