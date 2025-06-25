///
/// parse.js
/// 
/// Methods: parse() -- parse input text into an array of words
/// 		 deaccent(String) -- convert to simple ascii only
///			 analyze(String) -- check for various words and affixes
///					canCombine(String) -- can an affix attach to a given root?
///					addAffixParse(String, Object) -- format the affix and add to parse tree
///			 		analyzeAddCircumfix(String, String) -- for circumfix suffixes only
///			 	analyzeNA(String) -- check for non-affixing words
///			 	analyzeWord(String (, String)) -- try to break into affixes and roots,
///						optional parameter - last stripped off affix.rule (for rule checking)
///			 stressShift(String) -- some affixes change stress, changing root spelling,
///									tries to revert to geminate forms, altered vowels
///			 unredup(String) -- check for medial reduplication
///			 finalUnredup(String) -- check for final reduplication
///			 deaffixation(String, Array) -- try to remove affix
///			 linearize(Array) -- sort out parse trees
///			   removeDuplicates(Array) -- linearize(..) helper -- removes duplicate parses
///			   removeRepeatedMorphemes(Array) -- linearize(..) helper -- removes parses with repeated morphemes
///
/// has access to global constants:
///			 words, affixes, non_affixing_words, affixation_combinations
///
///
/// basic format works off of Hunspell affix definition files, with some tweaks
/// Hunspell has trouble with atypical characters in words, like: ',",-, etc. -- these are handled differently here
/// (largely ignored in comparisons, since often misspelled)
/// Also handles circumfixes differently, since hunspell seems to struggle with those.
/// Introduces CFXPFX and CFXSFX -- circumfixial prefixes and suffixes, which should be listed as affix_type in the affix file
/// The affix file is also put into object notation (from a spreadsheet), with alternate display forms (alt_form)
/// Circumfixing rules test prefix parts first, then suffix parts (which is slightly more efficient for CHamoru)
///
///



//
// Parse
//
// parse(String)
//
// takes: string of one or many words
//
// method: prepare the string for analysis: sanitize, break into words
//		   then call analysis subroutines
//
// returns: Array of the form [String, Object, Array]    (entry, {parses}, [linearized-parses])
//
function parse(entry) {
	
	var entries = [];  //allow multiple input words
	var parses = [];  //all ouput parses	
	
	//change all curly apostrophes to regular apostrophes
	entry = entry.replace(/[‘]/g, "'").replace(/[’]/g, "'");
	
	//Only take alphabetic, lona', n-tilde, accented letters, spaces, dash, and glotta
	//Replace others with spaces
	entry = entry.replace(/[^a-zA-ZÅÁÉÍÓÚáéíóúåÑñ \-']+/g, ' ');
	
	//Discard leading and trailing spaces
	entry = entry.trim();
	
	//De-accent
	//if (checkbox?) deaccent;  (just do by default for now)
	entry = deaccent(entry);
	
	//Get each word in the input
	entries = entry.split(/[ ]+/);
	
	//Analyze each
	for (var i in entries) {
		parses.push( [entries[i], analyze(entries[i]) ] );
	}
	
	//return the formatted parses
	return linearize(parses);
}


//
// De-accent
//
// Remove all diacritics
// Normalize unicode by breaking into compound symbols...
//   ...then discard anything over the ascii range
//
// (Q: why not do this on the raw input?
//  A: we want to later display words as they were input)
//
function deaccent(str) {
	str = str.normalize("NFD").replace(/[\u0300-\u036f'\-]/g, "");  //NFD : Canonical Unicode Decomposition
	str = str.toLowerCase();
	return str;
}


//
// Analyze
//
// Check for non-affixing-words,
// then check for affixes and roots
//
// gets passed a word to analyze
// returns a parse tree
//
function analyze(word) {
	var word_parses = {};  //parse tree for an individual word
	
	word_parses = analyzeNA(word);
	if (Object.keys(word_parses).length < 1) {  //if analyzeNA came back empty-handed... check for complex words (do we want this?, or should it always deconstruct?)
		word_parses = analyzeWord(word);
	}
	
	return word_parses;
}

	
//
// Analyze for Non-Affixing words
//
// Basic method: look up in non_affixing_words
// 				 if entry exists, add to parse tree
// 
// gets passed a word and returns the current parse tree
//
function analyzeNA(word) {
	var word_parses = {};
	
	//check for non-affix-taking function words
	if (tries.non_aff_words.includes(word)) {
		
		//get words (properties) from end node
		var results = tries.non_aff_words.lastNode(word).pr;
		
		//Some entries have alternate display info after a /
		//Use the alternate glosses when present
		for (var i in results) {
			var base_word = results[i].split("/", 1)[0]; 	//take base word until "/"
			var alt_gloss = results[i].split("/", 2);  		// take alternate glosses after "/"
			
			//if there's an alternate gloss, use it
			if (alt_gloss.length > 1) {
				word_parses["NA"+i] = { morpheme_type: "NA",      // add in any found as a sub-object
										morpheme_value: base_word,
										morpheme_text: ("<span class=\"roots\" id=\"NA" + i + "_" + base_word + "\">" + alt_gloss[1] + "</span>") };
			}
			
			//otherwise, put [ROOT]
			if (alt_gloss.length == 1) {
				word_parses["NA"+i] = { morpheme_type: "NA",      // add in any found as a sub-object
										morpheme_value: base_word,
										morpheme_text: ("<span class=\"roots\" id=\"NA" + i + "_" + base_word + "\">[ROOT]</span>") };
			}
		}
	}
	
	return word_parses;
}


//
// Analyze for Words
//
// Basic method: try to look up entry in word list (and check if it allows the last-stripped affix, if any)
// then, try to shave off affixes (again, if those affixes can combine with the last-stripped affix, if any)
// test for root again, ...lather, rinse, repeat
// 
// Recursive for branching every time that it has a hit (root or affix)
// consider English: 'evening' could either be a noun for 'a time of day'
// ...or could be a verbal form indicating 'to make more even'
// all possible analyses should be presented
//
// gets passed a word to analyze, and optionally the last affix.rule stripped off (to check for ok combining)
//
function analyzeWord(word, last_affix_rule="") {
	
	var word_parses = {};

	//
	// canCombine(word)  ||  canCombine(code) <-- can be just the affix code as well
	// 
	// checks if a word | affix can combine with the last_affix_rule (passed in above)
	// some words contain group codes for which affixes they can take
	// 	"word/0102"		(base entry / two-character group codes") (This is a Hunspell convention)
	// optimally all words would have codes, but they don't,
	// so use a default code when missing codes
	//
	function canCombine(word) {
		
		//if it's the first stripped affix, no prior affix to compare to
		if (last_affix_rule.length < 1)  return true;
		
		//***TODO*** -- I'm pretty sure this needs to be rewritten
		//or that the affix rules need to be rewritten
		//Currently things like "man-" (AGR[PL]) are not attaching to the right things
		//Seems they are not checking against the right affix rules
		
		let combining_rules = word.split("/", 2);	//split string by "/", max 2 parts
		
		if (combining_rules.length < 2)  combining_rules = ["02"];  	//no rules? default (eventually change blank to non-affixing?)
		else  combining_rules = combining_rules[1].match(/.{1,2}/g); 	//if rules exist, set to rules (split into Array by two-characters chunks)
	
		//now that we've got the combining rules...
		//check to see if last_affix_rule is in the rule set(s)
		//(affix_combinations is a global from rules.js)
		for (var j of combining_rules) {
			if (affixation_combinations[+j].includes(last_affix_rule)) {
				return true;
			}
		}
		return false;	//if not in any rules
	}
	
	//
	// addAffixParse(result, parse-tree)
	//
	// Formatting for found parses on Affixes
	//
	function addAffixParse(result, parse) {
		
		//create a key name (some parses might produce similar names, so iterate dusplicates)
		var affix_key_orig = "AFF_" + result.rule + result.id;
		var affix_key = affix_key_orig;
		var i = 0;
		while (affix_key in word_parses) {
			affix_key = affix_key_orig + i;
			i++;
		}
		
		if ((JSON.stringify(parse)).includes("[ROOT]")) {   //if the parse was successful (includes a ROOT form, then)
			if (("alt_form" in result) && (result["alt_form"].length > 0)) {
				word_parses[affix_key] = 
					{ morpheme_type:result.affix_type,		//add the affix
					  morpheme_value:result.alt_form,		//with the preferred affix text...
					  morpheme_text:result.definition,		//
					  subparse: parse};  					//and the subtree
			} else {
				word_parses[affix_key] = 
					{ morpheme_type:result.affix_type,      			//add the affix
					  morpheme_value:result.add.match(/^([^\/]*)/)[0],	//with default affix text...
					  morpheme_text:result.definition,	   				//
					  subparse: parse};  					   			//and the subtree
			}
		}
	}
	
	//
	// analyzeAddCircumfix
	//
	// Basic method: Similar to prefix / suffix search, but just for circumfixes
	//
	function analyzeAddCircumfix(word, prefix) {
		var sub_parses = {};
		
		for (var i = word.length; i > -1; i--) {
			if (tries.affixes.includes(word.substring(i))) {
				var results = tries.affixes.lastNode(word.substring(i)).pr;
				for (var j in results) {
					var word_substring = "";
					if (results[j].affix_type == "CFXSFX" && results[j].rule == prefix.rule) {
						var subparse = deaffixation(word, results[j]);	//deaffixation(..) returns [removable?(t/f), [valid-subparses]]
						if (subparse[0] == true) {
							var parse = analyzeWord(subparse[1][0], results[j].rule);
							result = results[j];
							if ((JSON.stringify(parse)).includes("[ROOT]")) {   //if the parse was successful (includes a ROOT form, then)
								if ("alt_form" in result) {
									sub_parses["AFF_" + result.rule + result.id ] = 
										{ morpheme_type:result.affix_type,		//add the affix
										  morpheme_value:result.alt_form,		//with the preferred affix text...
										  morpheme_text:result.definition,		//
										  subparse: parse};  					//and the subtree
								} else {
									sub_parses["AFF_" + result.rule + result.id] = 
										{ morpheme_type:result.affix_type,      			//add the affix
										  morpheme_value:result.add.match(/^([^\/]*)/)[0],	//with default affix text...
										  morpheme_text:result.definition,	   				//
										  subparse: parse};  					   			//and the subtree
								}
								if ("alt_form" in prefix) {
									word_parses["AFF_" + prefix.rule + prefix.id ] = 
										{ morpheme_type:prefix.affix_type,		//add the affix
										  morpheme_value:prefix.alt_form,		//with the preferred affix text...
										  morpheme_text:prefix.definition,		//
										  subparse: sub_parses};  				//and the subtree
								} else {
									word_parses["AFF_" + prefix.rule + prefix.id] = 
										{ morpheme_type:prefix.affix_type,      			//add the affix
										  morpheme_value:prefix.add.match(/^([^\/]*)/)[0],	//with default affix text...
										  morpheme_text:prefix.definition,	   				//
										  subparse: sub_parses};  					   		//and the subtree
								}
							}
						}
					}
				}
			}
		}
	}
	
	
	//
	// ** main logic **
	//
	
	//check for base words
	if (tries.words.includes(word)) {
		
		//get words (properties) from end node
		var results = tries.words.lastNode(word).pr;
		
		for (var i in results) {
			
			//if it is a base word, then add to the parses
			if (canCombine(results[i])) {
				var base_word = results[i].split("/", 1)[0];	//take base word until "/" for combining order rules
				word_parses["W"+i] = { morpheme_type: "ROOT",	//add in any found as a sub-object
									   morpheme_value: base_word,
									   morpheme_text: ("<span href=\"#\" class=\"roots\" id=\"W" + i + "_" + base_word + "\">[ROOT]</span>") };
			}
		}
	}
	
	//now, try to take off affixes
	//(even if we found a root, it might be decomoposable)
	//(This can probably be made faster if we don't check for reduplication every time)
	//(pass parameter?)
	
	//First, check for final reduplication (and recurse if found)
	var redup = finalUnredup(word); //returns [t/f, subword, reduplication/affix]
	if (redup[0] == true) { //if reduplication
		var a = analyzeWord(redup[1], "BI");  //recurse!  *Final reduplication defined as Affix {"id":"##","affix_type":"RDP","rule":"BI","strip":".","add":"/13","condition":".","definition":"INTENS","alt_form":" "}
		if ((JSON.stringify(a)).includes("[ROOT]")) {   //if the parse was successful (includes a ROOT form, then)
			word_parses["AFF_"+"RDP_"+redup[2]] = {morpheme_type:"RDP",		//add the affix
											morpheme_value:"~" + redup[2],	//with the preferred affix text...
											morpheme_text:"INTENS",      	//definition
											subparse: a};  					//and the subtree
		}
	}
	
	//check for medial reduplication
	redup = unredup(word);	//returns array of arrays [[subword, reduplication],...]
	for (var i of redup) {
		if (canCombine(i[1] + "/07")){		// <-- CAREFUL!! This affix definition may change!!
			var a = analyzeWord(i[0], "A2");  //recurse!  *Medial reduplication defined as Affix {"id":"##","affix_type":"PFX","rule":"A2","strip":".","add":"/07","condition":".","definition":"PROG","alt_form":" "}
			if ((JSON.stringify(a)).includes("[ROOT]")) {   //if the parse was successful (includes a ROOT form, then)
				//depending on position in word, teat either as prefix or suffix
				//(might be better to write a method in linearization that moves it close to the thing it duplicates)
				if (i[2] < word.length / 2) {
					word_parses["AFF_"+i[1]] = {morpheme_type: "PFX",			//add the affix
												morpheme_value: i[1] + "~",		//with the prefixed affix text
												morpheme_text: "PROG",      	//definition
												subparse: a};					//and the subtree
				} else {
					word_parses["AFF_"+i[1]] = {morpheme_type: "SFX",			//add the affix
												morpheme_value: "~" + i[1],		//with the suffixed affix text
												morpheme_text: "PROG",      	//definition
												subparse: a};					//and the subtree
				}
			}
		}
	}
	
	//go through word L->R and then R->L and see if letters match any affixes
	for (var i = 0; i < word.length; i++) {
		
		//Now check for regular prefixes and circumfixes
		//does the affix trie include the letters so far?
		if (tries.affixes.includes(word.substring(0,i))) {
			
			//if so, get full affix properties from end node
			var affixes = tries.affixes.lastNode(word.substring(0,i)).pr;
			
			for (var aff of affixes) {
				var word_substring = "";	//hold possible de-affixed word
				
				//try to remove the affix
				if ((aff.affix_type == "PFX" || aff.affix_type == "CFXPFX")	//for prefixes and circumfixial prefixes
					&& canCombine(aff.add) ){
					//check to see if affix can be removed
					var subparse = deaffixation(word, aff);	//deaffixation(..) returns [removable?(t/f), [valid-subparses]]
					
					if (subparse[0] == true) {  //if it CAN be removed
						for (var k=0; k < subparse[1].length; k++) {  //then for each subparse...
							if (aff.affix_type == "CFXPFX") {
								analyzeAddCircumfix(subparse[1][k], aff);  //only look for circumfixes of the same rule
							} else {
								var a = analyzeWord(deaccent(subparse[1][k]), aff.rule);  //if not circumfix, just analyze the subparse
								addAffixParse(aff, a);
							}
						}
					}
				}
			}
		}
	}
		
	//And again for suffixes
	for (var i = word.length-1; i > -1; i--) {
		
		if (tries.affixes.includes(word.substring(i))) {
			var affixes = tries.affixes.lastNode(word.substring(i)).pr;
			for (var aff of affixes) {
				var word_substring = "";
				if (canCombine(aff.add) && aff.affix_type == "SFX") {
					var subparse = deaffixation(word, aff);	//deaffixation(..) returns [removable?(t/f), [valid-subparses]]
					if (subparse[0] == true) {
						for (var k = 0; k < subparse[1].length; k++) {
							var a = analyzeWord(deaccent(subparse[1][k]), aff.rule);
							addAffixParse(aff, a);
						}
					}
				}
			}
		}
	}
	return word_parses;
}



//
// stressShift(String)
//
// Restore spelling changed by shifts in stress
//
// Takes: string (a word)
//
// Method: 
// Stress shifts, particularly at the ends of words, can change spellings
//    Example: fóffo + -i -->  fofúyi   (note change in geminate and vowel)
// Suggests replacements spellings after an affix is removed
// (currently works on word ends, might need to expand to prexifes,
//  however most prefix reules account for spelling changes easily,
//  while suffixes can change letters in the middle of words)
// 
// Looks at end of word
// Finds the last vowel cluster,
//  then the next prior consonant cluster,	(referred to below as 'middle')
//  and the next prior vowels (?? - check)	(referred to below as 'middle')
// And then offers possible alt vowels and geminated consonants
//
// Example: apagåyi -> apåga + -i
// 			kahnåyi -> kåhna + -i
//			tattiyi -> tåtte + -i
//			fofuyi  -> foffo + -i
//			chuli'on -> chule' + -on
//			guaså'on -> guåsa' + -on
//			kachå'on -> kåcha  + -on
//			kanu'on  -> kånno' + -on
//			koni'on  -> konne' + -on
//
// Returns: array of candidates
//
// TODO: write function :P
//



//
// unredup(String)
//
// Undo medial reduplication
//
// Looks at a word from [1:length]
// (we can ignore position because the written out affixes will catch those)
// Then look at adjacent substrings from length 1 to 4
//   example: "abcdefghijk"
//   a[b][c]defghijk ... ab[c][d]efghijk ... etc.
//   a[bc][de]fghijk ... ab[cd][ef]ghijk ... etc.  (up to 4)
// if adjacent chunks are the same and of CⁿVⁿ form
// then return array of candidates
//
// returns an Array: [[String subword, String reduplication/affix, position], ...]  //can be multiple candidates
//
//
// TODO: HOW TO DEAL WITH STRINGS LIKE: pípeska  ?
//
function unredup(word){
	const vowels = "áéíóúåaeiou";
	const consonants = "ntskgmlh'drpbfcyñ-jvwzq";		//frequency ranked

	var candidates = [];
	var returns = [];
	
	var word2 = deaccent(word);	//typically done at beginning of script, but may be optional
	
	//do sliding window matching
	for (var i=1; i < word.length; i++) {	//start pos 1 for chars, ignore edge (written out reduplications will handle)
		for (var len = 1; len <= 4; len++) {	//len = length of window
			if (i + 2 * len <= word.length) {	//make sure indexes within word
				if (word2.substring(i, i + len) === word2.substring(i + len, i + 2 * len)	//deaccented compare
					&& vowels.includes(word2.substring(i + len -1, i + len))) {		//check if ends in a vowel
					candidates.push([word.substring(0,i+len) + word.substring(i+ 2*len, word.length), word.substring(i, i + len), i + len]);
				}
			}
		}
	}
	
	//candidates must be of form CⁿVⁿ (because V'V are caught by explicit edge cases)
	//convert, reduce, check form
	for (var n of candidates) {
		var redup = n[1];
		var cv = "";
		for (var j=0; j < redup.length; j++) {
			if (vowels.includes(redup[j])) cv += "v";
			if (consonants.includes(redup[j])) cv += "c";
		}
		cv = cv.replaceAll("cc","c").replaceAll("cc","c").replaceAll("vv","v").replaceAll("vv","v"); //needs to be run twice to catch overlaps
		if (cv == "cv") returns.push(n);
	}
	
	return returns;
}



//
// finalUnredup(String)
//
// undo final reduplication
//
// Looks at the end of a word
// Finds the last vowel cluster,
//  then the next prior consonant cluster,	(referred to below as 'middle')
//  and the next prior vowels,				(referred to below as 'middle')
// Then compares subchunks from end to before-last-vowels consonant cluster,
//  and then of same length from that cluster toward the beginning of the word
//
// returns an Array: [Boolean(removable), String subword, String reduplication/affix]
//
// *Note - Chung(2020) gives final reduplication as repetition of last CV in words that end with CV
// 		But in practice is more permissive. E.g., can do "hoben" -- hobebebebeben
//
// TODO -- currently, deaccenting removes glottal stops, however, these are necessary for determining reduplication...
// Will have to either run each word twice (with and without ') or change the vowel patterning here
//
function finalUnredup(word){
	const vowels = "áéíóúåaeiou";
	const consonants = "ntskgmlh'drpbfcyñ-jvwzq";		//frequency ranked
	var i_last_v, i_mid_c, i_mid_v,				//last vowel index, mid consonant index, mid vowel index
		first_chunk = "", second_chunk = "";


	word = word.toLowerCase();

	//find/get index of the word's last vowel, starting from end
	for (i_last_v = word.length-1; i_last_v > -1; i_last_v--) {
		if (vowels.includes(word[i_last_v]))
			break;
	}
	//get index of middle consonant cluster, starting from last vowel index
	for (i_mid_c = i_last_v; i_mid_c > -1; i_mid_c--) {
		if (consonants.includes(word[i_mid_c])) {
			if (i_mid_c > 1 && consonants.includes(word[i_mid_c-1]))
				continue;
			else
				break;
		}
	}
	
	//check if indexes are within word
	if (i_last_v < 0 || i_mid_c < 0) return [false,,];
	
	//grab end-of-word to before-last-vowels consonant cluster
	second_chunk = word.substring(i_mid_c, i_last_v+1);	//i_last_v+1 = letter after last vowel
	//grab from there toward beginning of the same length
	first_chunk = word.substring(i_mid_c - second_chunk.length, i_mid_c);		//substring parameters less than 0, treated as 0, so no worries on negative indexes
	
	//if word ends in C, last vowel might be lower than in prior reduplication. Check alt with raised vowels
	var alt_second_chunk = second_chunk;
	if (alt_second_chunk.includes("o")) {
		alt_second_chunk = alt_second_chunk.replaceAll("o","u");
	} else if (alt_second_chunk.includes("e")) {
		alt_second_chunk = alt_second_chunk.replaceAll("e","i");
	}
	
	//return: is-reduplicated?, potential de-affixed word, stripped off reduplication (to display as an affix)
	return [((second_chunk == first_chunk) || (alt_second_chunk == first_chunk)), (word.substring(0,i_mid_c - second_chunk.length) + word.substring(i_mid_c,word.length)), first_chunk];
}



//
// deaffixation
//
// Checks if removing an affix is allowable given the base word
// Then tries to remove the affix
//
// takes: word, affix[]
// returns a 2-item vector: [Boolean(removable), Array(deaffixated words)]
//
function deaffixation(word, affix) {
	var test_against = []; //letters to check
	var subparse = "";
	var deaccented_affix = deaccent(affix.add.match(/^([^\/]*)/)[0]); // take affix up until "/" for combining rules
	affix.strip = affix.strip.replaceAll("'","");	//remove glottas in replacements for deaccenting -- probably should make this optional
	
	if (affix.condition.length == 0) return [false, ""];
	if (affix.condition == ".") {
		if (affix.affix_type == "PFX" || affix.affix_type == "CFXPFX") {
			if (+affix.strip == 0) {
				subparse = word.substring(deaccented_affix.length,word.length);
			} else {
				subparse = affix.strip + word.substring(deaccented_affix.length,word.length);
			}
			return [true, [subparse]];
		}
		if (affix.affix_type == "SFX" || affix.affix_type == "CFXSFX") {
			if (+affix.strip == 0) {
				subparse = word.substring(0,word.length-deaccented_affix.length);
			} else {
				subparse = word.substring(0,word.length-deaccented_affix.length) + affix.strip;
			}
			return [true, [subparse]];
		}
	}
	if (affix.condition.substring(0,1) == "[") {
		test_against = affix.condition.match(/[a-zA-ZÅÁÉÍÓÚáéíóúåÑñ\-']/g);    // .match returns an array of the string matches
		if (affix.condition.substring(1,2) == "^") {   //check for forbidden bases ("^" is not included in test_against)
			for (var i in test_against) {    //go through test_against (affix attachment conditions) and check for matches
				if (affix.affix_type == "PFX" || affix.affix_type == "PFXCFX") {
					if (word.substring(deaccented_affix.length, deaccented_affix.length+1) == deaccent(test_against[i])) { //check 1st letter of word after affix
						return [false, ""];
					}
				}
				if (affix.affix_type == "SFX" || affix.affix_type == "PFXSFX") {
					if (word.substring(word.length-deaccented_affix.length-1, word.length-deaccented_affix.length) == deaccent(test_against[i])) {
						return [false, ""];
					}
				}
			}  //if it passes the comparison...
			if (affix.affix_type == "PFX" || affix.affix_type == "CFXPFX") {
				if (+affix.strip == 0) {  //*** This may cause issues later... what abbout cases of 1 with a [^...]? Shouldn't come up?
					subparse = word.substring(deaccented_affix.length, word.length);
				} else {
					subparse = affix.strip + word.substring(deaccented_affix.length, word.length);
				}
				return [true, [subparse]];
			}
			if (affix.affix_type == "SFX" || affix.affix_type == "CFXSFX") {
				if (+affix.strip == 0) {  //*** This may cause issues later... what abbout cases of 1 with a [^...]? Shouldn't come up?
					subparse = word.substring(0,word.length-deaccented_affix.length);
				} else {
					subparse = word.substring(0,word.length-deaccented_affix.length) + affix.strip;
				}
				return [true, [subparse]];
			}
			
		}  
		if (+affix.strip == 0) {  //no assimilation
			for (var i in test_against) {  //go through test_against (affix attachment conditions) and check for matches == requisite set of bases
				if (affix.affix_type == "PFX" || affix.affix_type == "CFXPFX") {
					if (word.substring(deaccented_affix.length, deaccented_affix.length+1) == deaccent(test_against[i])) { //does the letter after the prefix match the requisite letter?
						subparse = word.substring(deaccented_affix.length, word.length);
						return [true, [subparse]];
					}
				}
				if (affix.affix_type == "SFX" || affix.affix_type == "CFXSFX") {
					if (word.substring(word.length-deaccented_affix.length-1, word.length-deaccented_affix.length) == deaccent(test_against[i])) {
						subparse = word.substring(0,word.length-deaccented_affix.length);
						return [true, [subparse]];
					}
				}
			}
		}
		if (+affix.strip == 1) {  //assimilation / deletion
			//here's where we have to guess and return possible words -- (e.g. remove [b,p], replace with [m]... going backwards try both)
			var all_subparses = [];
			for (var i = 0; i < test_against.length; i++) {  //go through test_against (affix attachment conditions) and check for matches == requisite set of bases
				if (affix.affix_type == "PFX" || affix.affix_type == "CFXPFX") {
					subparse = test_against[i] + word.substring(deaccented_affix.length, word.length);
					all_subparses.push(subparse);
				}
				if (affix.affix_type == "SFX" || affix.affix_type == "CFXSFX") {
					subparse = word.substring(0,word.length-deaccented_affix.length) + test_against[i];	
					all_subparses.push(subparse);
				}
			}
			return [true, all_subparses];
		}
	}
	return [false, ""]; //none of the defined affix types
}


//
// linearize(Array)
//
// Takes: an Array of Arrays (one sub-array for each word in input)
//	[["word", {nested morphemes}, [linear array of morphemes (not in order)]], ...]
//
// Method: take all parses trees, and sort out into linearized arrays of affixes
// then return only unique values, sorted by number of affixes (sm -> lg)
//
// Returns: updated parses (Array of Arrays)
//
function linearize(parses) {
	
	var linear_parses = [];	//hold linearized parses
	
	//check for objects
	function isObject(o) {
		return o && o.constructor === Object;
	}
	
	//helper function -- recursively un-nest -- sort into prefixes / suffixes
	function iter(parse, prefixes, suffixes) {
		let keys = [];
		if (isObject(parse)) keys = Object.keys(parse);
		if (keys.includes("morpheme_type")) {
			let morpheme = {};
			for (k in keys) { // attach all properties, but not the subparses
				if (!isObject(parse[keys[k]])) {
					morpheme[keys[k]] = parse[keys[k]];
				}
			}
			if (parse.morpheme_type == "PFX" || parse.morpheme_type == "CFXPFX") {
				prefixes = prefixes.concat([morpheme]);
			} else if (parse.morpheme_type == "SFX" || parse.morpheme_type == "CFXSFX" || parse.morpheme_type == "RDP") {
				suffixes = [morpheme].concat(suffixes);
			} else {   //Words and non-affixing-words
				linear_parses.push(prefixes.concat([morpheme].concat(suffixes)));
			}
		}
		if (keys.includes("subparse")) {
			let next_obj = parse.subparse;
			let subkeys = Object.keys(next_obj);
			for (var i in subkeys) {
				iter(next_obj[subkeys[i]], prefixes, suffixes);
			}
		}
	}
	
	//iterate through parses for each word in the input
	//and sort affixes into prefixes & suffixes
	//order affixes and attach
	for (var p of parses) {
		linear_parses = [];
	
		var initial_keys = Object.keys(p[1]);	//each parse is of form:  ["entry", {obj}]
		for (var i of initial_keys) {
			iter(p[1][i], [], []);
		}
		
		linear_parses = removeDuplicates(linear_parses);
		linear_parses = removeRepeatedMorphemes(linear_parses);
		linear_parses = removeUnnecessaryFronting(linear_parses);
		linear_parses.reverse().sort(function (a,b,) {return a.length - b.length;});	//sort from shortest to longest
	
		p.push(linear_parses);  //after push(), parse will be of form:  ["entry", {obj}, [linearized parses]]
	}
	return parses;
}

// Helper function for linearize(...)
// remove dulplicate sub-objects
//   (may have arrived at same parse in different ways)
//   (e.g. redoing -> [re-doing] -> [re-do-ing] )
// 	(	  		  -> [redo-ing] -> [re-do-ing] )  (would now have two identical parses)
// Can't compare Objects directly, so turn objects into strings,
// put those in an array, and check if new strings are alreay there
// if not, add object to a uniques object array
function removeDuplicates(linear_parses) {
	var uniques_stringified = [];
	var uniques = [];
	for (var i in linear_parses) {
		var parse_stringify = JSON.stringify(linear_parses[i]);
		if (!(uniques_stringified.includes(parse_stringify))) {
			uniques_stringified.push(parse_stringify);
			uniques.push(linear_parses[i]);
		}
	}
	return uniques;
}

// Helper function for linearize(...)
// 
// remove parses where the derivation contains many of
// the same morphemes (except for final reduplication)
// (e.g. English singing can't be [s-ing-ing])
function removeRepeatedMorphemes(linear_parses) {
	var allowed = [];
	for (var i in linear_parses) {
		var a = linear_parses[i];
		var okay = true;
		for (var j = 0; j < a.length-1; j++) {
			for (var k = j+1; k < a.length; k++) {
				if ((a[j].morpheme_text != "INTENS")					//except for final reduplication...
					&& (a[j].morpheme_type != "CFXPFX")					//or circumfixing
					&& (a[k].morpheme_type != "CFXPFX")					//
					&& (a[j].morpheme_text == a[k].morpheme_text) ) {	//if any of the morphemes are the same...
					okay = false;										//then the parse is bad
				}
			}
		}
		if (okay) allowed.push(linear_parses[i]);
	}
	return allowed;
}

// Helper function for linearize(...)
//
// If everything is deaccented, then vowel fronting
// will seem to apply to all low vowels (as å/a are same)
// removes these extra parses
// (make optional in future)
// Careful! -- fragile -- requires exact string: "(Vowel<br>Fronting)"
function removeUnnecessaryFronting(linear_parses) {
	let unflat = [];
	let flattened = [];  //need to stringify to compare objects in JS
	let fronted = [];

	//separate parses into ones that have fronting and those that don't
	while (linear_parses[0]) {
		let p = linear_parses.pop();
		if (p[0].morpheme_text == "(Vowel<br>Fronting)") {
			fronted.push(p);
		} else {
			flattened.push(JSON.stringify(p));
			unflat.push(p);
		}
	}
	
	//for fronted entries that do not match existing parses, add back to parses
	while (fronted[0]) {
		let p = fronted.pop();
		if (!flattened.includes(JSON.stringify(p.slice(1))))	//compare to string version of entry without fronting
			unflat.push(p);
	}
	return unflat;
}