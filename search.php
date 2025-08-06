<?php	
	//*******************************************************************************
	// THIS IS MEANT TO SERVE BOTH DIKSIONARIU.COM AND THE EDIT BACKEND
	// (Requires search_b.php for site-specific information and forwarding)
	//
	// Contents
	//  
	// Variable declarations
	//	- Extract values from passed query parametes
	//
	// Main Logic
	//
	// Functions (Searches)
	//
	//	search_by_index()			//read-view
	//	search_examples()			//q1::q2  (q1 in 'entry', q2 in 'examples')
	//	search_single_entry()		//Chamoru search
	//	search_related_also()		//CHamoru search in 'related_forms', 'see_also'
	//	search_partial()			//CHamoru search, partial matches (3 characters or more)
	//	search_definitions()		//English search / q1:q1 (q1 in 'entry', q2 in 'definition')
	//
	//	return_all_words(Bool)		//return all 'entry', 'alternate_forms', 'related_forms', 'see_also' for fuzzy search (t/f = direct to fuzzy)
	//	return_null_result()		//return 0 for messaging / debugging
	//
	//*******************************************************************************
	
	header('Content-Type: text/html; charset=utf-8');
	$hashed_entry = (isset($_GET['e'])) ? strval($_GET['e']) : false;	//required by search_b.php
	require './search_b.php';
	
	// Load the results.html template into a variable
	ob_start();
	include 'results.html';
	$html_template = ob_get_clean();
	$insert_code = "";
	
	// (if user data exists), insert user info into logout button
	if(isset($configure_user_logout_button)) {
		$html_template = str_replace('<!-- PHP inserts code here -->', '<!-- PHP inserts code here --><br>'.$configure_user_logout_button, $html_template);
	}
	
	
	// set up database connection
	$db_connect = mysqli_connect(DB_SERVER, DB_USER, DB_PASS, "diksionariu");

	// if can't connect to SQL, give error code, output html, and exit
	if (mysqli_connect_errno()) {
		$html_template =
			str_replace('<!-- PHP inserts code here -->',
						'<script>document.getElementById("results").innerHTML = "Could not connect to database: \n' . mysqli_connect_error() . '";</script>',
						$html_template);
		echo $html_template;
		exit();
	}
	
	mysqli_set_charset($db_connect, 'utf8mb4');
	
	
	// extract variables from query
	$q 				= (isset($_GET['q'])) ? urldecode(strval($_GET['q'])) : "";	// query (encoding/decoding helps with issues with diacritics)
	$entry_index 	= (isset($_GET['i'])) ? intval($_GET['i']) : 0;				// db index for multiple-entry page view (get surrounding 20 entries by index)
	//$hashed_entry = (isset($_GET['e'])) ? strval($_GET['e']) : false;			// hashed entry (unique in table) for stable links	//**Now handled before 'require' statement**
	$highlight		= (isset($_GET['h'])) ? intval($_GET['h']) : "";			// highlighting turned on? (multiple view, blue -- if browsing by Letter (from main page), don't highlight)
	$search_window	= (isset($_GET['w'])) ? intval($_GET['w']) : "";			// # of surrounding entries in page-view (currently unusued)
	$lang 			= (isset($_GET['lx'])) ? strval($_GET['lx']) : "CH";		// lang: CH or Eng ?
	
	
	// sanitize
	$q2 = mb_convert_encoding($q, "UTF-8");
	$q2 = str_replace(['‘', '’'], "'", $q2);		// change all curly apostrophes to regular apostrophes
	$q2 = preg_replace('/[^0-9a-zA-ZÅÁÉÍÓÚáéíóúåÑñ \.\-\'*?≈#:]+/', ' ', $q2);	// Only take alphanumeric, lona', n-tilde, accented letters, space, period, dash, glotta, and wildcards * ? ~ # :
	$q2 = str_replace("'","''",$q2);	// escape-code apostrophes
	
	// change wildcards to the appropriate SQL wildcards
	$q2 = str_replace("*","%",$q2);
	$q2 = str_replace("?","_",$q2);
	
	// define possible sepcial characters in queries
	$specials  = ['-',"'",'%','_','̴','#'];	// note that we just replaced (* -> %) and (? -> _) above
	$diacritic = ['Å','Á','É','Í','Ó','Ú','á','é','í','ó','ú','å','Ñ','ñ'];
	
	$has_special = false;
	$has_diacritic = false;
	foreach ($specials as $special_char) {
		if (strpos($q2, $special_char) !== false) {
			$has_special = true;
			break;
		}
	}
	foreach ($diacritic as $special_char) {
		if (strpos($q2, $special_char) !== false) {
			$has_diacritic = true;
			break;
		}
	}
	
	
	//************//
	// Main Logic //
	//************//
	
	// First, check if we are searching by number (read-view)
	if ((int)$entry_index > 0) {		// SQL table `diksionariu` index_num starts at 1, if there's no query-provided entry_index, it converts to 0 (null/false)
		$res = search_by_index();
		if (!$res) {	// if no results (generally out-of-range error)
			return_null_result();
		}
	
	// General Searches
	} else {
	
		// Now, check for parse requests
		if (strpos($q2, '#') !== false) {
			return_parse_query();
		
		// Then, check for fuzzy search
		// (sends back lookup table)
		} elseif (strpos($q2, '≈') !== false) {
			return_all_words(true);
		
		// Otherwise...
		} else {
			// English search (search in definitions)
			// (Also checks for compound search 'xxx:yyy', which uses English-results foramtting)
			if ($lang === 'Eng') {
				search_definitions();
			}
			// CHamoru searches
			if ($lang === 'CH' ) {
				// Example Search (CHamoru search with '::')
				if (strpos($q2, '::') !== false) {
					$res = search_examples();
					if (!$res) {
						return_null_result();
				}}
				// Regular CHamoru search
				if (strpos($q2, '::') == false) {
					$res = search_single_entry();
					if (!$res) {
						// if no results, look in 'alternate_forms', 'related_forms', 'see_also'
						$res = search_related_also();
						if (!$res) {
							// if no results, try searching for partial matches in 'entry'
							$res = search_partial();
							if (!$res) {
								// if no results...
								return_all_words(false);
	}}}}}}}
	
	
	
	//*****************************************************
	// Search by Index
	// (Multiple-results)
	// 
	// Take an index number and return the surrounding 20
	// results. The searched index will appear in position
	// 5 (halfway-down first column). If highlighting is
	// turned on, then highlight the searched-for index
	//*****************************************************
	function search_by_index()
	{
		global $db_connect, $insert_code, $entry_index, $highlight;
		
		// Get letter indexes for Big Letters
		// ***this is also in index.php -- any changes should apply to both****
		$sql = "SELECT MIN(index_num) AS start_index, 
			IF(LEFT(entry, 1) = '-', SUBSTRING(entry, 2, 1), LEFT(entry, 1)) AS letter
			FROM diksionariu
			GROUP BY letter COLLATE utf8mb4_unicode_ci
			ORDER BY letter ASC";
		
		$result2 = mysqli_query($db_connect, $sql);
		$results_array2 = array();
		
		if ($result2->num_rows > 0) {
			while($row = mysqli_fetch_array($result2, MYSQLI_ASSOC)) {
				$results_array2[] = $row;
			}
			$results_array2 = mb_convert_encoding($results_array2, "UTF-8");
			$insert_code = $insert_code . 
				'<script>
					const letter_indexes = ' . json_encode($results_array2) . ';
				 </script>';
				
			// free up the memory from the result set
			mysqli_free_result($result2);
		}
		
		// get the entries in the given range
		$starting_index = 1;
		$endingIndex = $entry_index + 18;	// if the ending index is higher than the table, it will just return available lines until the end of the table, it will not fail or return an error
	
		if ($entry_index > 2) {$starting_index = $entry_index - 2;}

		$sql = "SELECT * FROM diksionariu WHERE index_num BETWEEN " . $starting_index . " AND " . $endingIndex . " ORDER BY CAST(index_num AS UNSIGNED) LIMIT 21";
		
		$result = mysqli_query($db_connect, $sql);
		$results_array = array();

		if ($result->num_rows > 0) {
			while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
				$results_array[] = $row;
			}
			$insert_code = $insert_code . '<script>displayCHMultiple("' . $entry_index . '",' . json_encode($results_array) . ',"' . $highlight . '");</script>';
			
			// free up the memory from the result set
			mysqli_free_result($result);
			
			return true;
		
		} else {
			return false;
		}
	}
	
	
	//*****************************************************
	// Compound Example Search  "::"
	// (CHamoru) (Multiple-results)
	// 
	// Search for a given CHamoru string from entry
	// and a second string from examples
	// Basic search ignores diacritics, caps, and ' -
	// Wildcard search is literal
	//*****************************************************		
	function search_examples()
	{
		global $db_connect, $insert_code, $specials, $sitename, $q, $q2;
		
		// save current search in page_settings to correctly show what was searched in the search box on the results page
		// take the query from the PHP address and place in the search entry box on the results page
		// and change the page title to reflect the search query
		$insert_code = $insert_code . '<script>page_settings.current_search = "CH";
			document.getElementById("entry").value = "' . $q . '";
			if (document.getElementById("under-search-entry") !== null)  document.getElementById("under-search-entry").value =  "' . $q . '";
			document.getElementsByTagName("title")[0].innerHTML = "' . $q . '" + " - ' .  $sitename . '"; </script>';
		
		// split string by ::
		$pieces = explode("::", $q2);
		$pieces[0] = trim($pieces[0]);
		$pieces[1] = trim($pieces[1]);
		
		//for basic searches, ignore apostrophes and dashes
		$sql = 'SELECT * FROM diksionariu
				WHERE examples LIKE "%' . $pieces[1] . '%" 
				AND REPLACE( REPLACE(entry, "\'", ""),  "-", "")
				LIKE REPLACE( REPLACE("' . $pieces[0] .  '", "\'", ""),  "-", "")';
		
		// However, if query contains wildcards or contains any special characters,
		// allow ' and - 	(i.e.: search as entered)
		// Start by going through specials and look to see if search string contains one of them
		$has_special = false;
		foreach ($specials as $special_char) {
			if (strpos($pieces[0], $special_char) !== false) {
				$has_special = true;
				break;
			}
		}
		// if query contains one of these, don't replace
		if ($has_special) {
			$sql = "SELECT * FROM `diksionariu` WHERE examples LIKE '%" . $pieces[1] . "%' AND entry LIKE '" . $pieces[0] . "' ORDER BY CAST(index_num AS UNSIGNED)";
		}
		
		$has_diacritic = false;
		foreach ($diacritic as $special_char) {
			if (strpos($pieces[0], $special_char) !== false) {
				$has_diacritic = true;
				break;
			}
		}
		// If a letter with a diacritic was entered, use COLLATE statement to match diacritics
		if ($has_diacritic) {
			$sql = "SELECT * FROM diksionariu where WHERE examples LIKE '%" . $pieces[1] . "%' AND entry COLLATE utf8mb4_bin like '" . $pieces[0] . "' ORDER BY CAST(index_num AS UNSIGNED)";
		}
		
		
		$result = mysqli_query($db_connect, $sql);
		$results_array = array();
		
		if ($result->num_rows > 0) {
			while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
				$results_array[] = $row;
			}
			$results_array = mb_convert_encoding($results_array, "UTF-8");
			
			$insert_code = $insert_code . '<script>displayCHResults("' . $q . '",' . json_encode($results_array) . ');</script>';
			
			// free up the memory from the result set
			mysqli_free_result($result);
			
			return true;
			
		} else {
			return false;
		}
	}		
	
	
	//*****************************************************
	// Single-Entry Search
	// (CHamoru) (Multiple-results)
	// 
	// Search for query in 'entry' or 'alternate_forms'
	// Basic search ignores diacritics, caps, and ' -
	// Wildcard search is literal
	//*****************************************************		
	function search_single_entry()
	{
		global $db_connect, $insert_code, $specials, $has_special, $has_diacritic, $sitename, $q, $q2;
		
		// save current search in page_settings to correctly show what was searched in the search box on the results page
		// take the query from the PHP address and place in the search entry box on the results page
		// and change the page title to reflect the search query
		$insert_code = $insert_code . '<script>page_settings.current_search = "CH";
			document.getElementById("entry").value = "' . $q . '";
			if (document.getElementById("under-search-entry") !== null)  document.getElementById("under-search-entry").value =  "' . $q . '";
			document.getElementsByTagName("title")[0].innerHTML = "' . $q . '" + " - ' .  $sitename . '"; </script>';
		
		// for basic searches, ignore apostrophes and dashes
		$sql = "SELECT * FROM diksionariu "
			. "WHERE REPLACE("
				. "REPLACE(entry, \"'\", ''),"
					."\"-\", '') "
			. "LIKE REPLACE("
				. "REPLACE('" . $q2 .  "', \"'\", ''),"
					. "\"-\", '') "
			. "OR REPLACE("
				. "REPLACE(alternate_forms, \"'\", ''),"
					. "\"-\", '') "
			. "LIKE REPLACE("
				. "REPLACE('%[[" . $q2 .  "]]%', \"'\", ''),"
					."\"-\", '') "
			. "ORDER BY CAST(index_num AS UNSIGNED)";
		
		
		// If a letter with a diacritic was entered, use COLLATE statement to match diacritics
		if ($has_diacritic) {
			$sql = "SELECT * FROM diksionariu "
			. "WHERE REPLACE("
				. "REPLACE(entry, \"'\", ''),"
					."\"-\", '') "
			. "LIKE REPLACE("
				. "REPLACE('" . $q2 .  "', \"'\", ''),"
					. "\"-\", '') COLLATE utf8mb4_bin "
			. "OR REPLACE("
				. "REPLACE(alternate_forms, \"'\", ''),"
					. "\"-\", '') "
			. "LIKE REPLACE("
				. "REPLACE('%[[" . $q2 .  "]]%', \"'\", ''),"
					."\"-\", '') COLLATE utf8mb4_bin "
			. "ORDER BY CAST(index_num AS UNSIGNED)";
		}
		
		// If query contains wildcards or contains any special characters,
		// allow ' and - 	(i.e.: search as entered)
		// if query contains one of these, don't replace
		if ($has_special) {
			$sql = "SELECT * FROM diksionariu WHERE entry LIKE '" . $q2 . "' "
				. "OR alternate_forms LIKE '%[[" . $q2 ."]]%' "
				. "ORDER BY CAST(index_num AS UNSIGNED)";
		}
		
		
		$result = mysqli_query($db_connect, $sql);
		$results_array = array();
		
		// if any results from 'entry' column...
		if ($result->num_rows > 0) {
			while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
				$results_array[] = $row;
			}
			$results_array = mb_convert_encoding($results_array, "UTF-8");
			
			$insert_code = $insert_code . '<script>displayCHResults("' . $q . '",' . json_encode($results_array) . ');</script>';
			
			// free up the memory from the result set
			mysqli_free_result($result);
			
			return true;
		} else {
			return false;
		}
	}
	
	
	//***********************************************************
	// Search for matches in related / see also fields
	// (CHamoru) (Multiple-results)
	// 
	// If no results from entry or alternate columns...
	// search 'related_forms' or 'see_also'
	// for the search text within internal links [[..]]
	//
	// Basic search ignores diacritics, caps, and ' -
	// Wildcard search is literal
	//***********************************************************
	function search_related_also()
	{	
	
		global $db_connect, $insert_code, $specials, $has_special, $sitename, $q, $q2;
		
		// ignore apostrophes and dashes
		// search in 'alternate_forms' or 'related_forms'
		// because those fields can be long, use %[[query]]%
		$sql = "SELECT * FROM diksionariu
				WHERE REPLACE(
					REPLACE(related_forms, \"'\", ''),
					\"-\", '')
				LIKE REPLACE(
					REPLACE('%[[" . $q2 .  "]]%', \"'\", ''),
					\"-\", '')
				OR REPLACE(
					REPLACE(see_also, \"'\", ''),
					\"-\", '')
				LIKE REPLACE(
					REPLACE('%[[" . $q2 .  "]]%', \"'\", ''),
					\"-\", '')";
			
		// as above, if query contains wildcards, allow ' and -
		//
		// One special issue here is that wildcard searches may overflow the [[...]] bounds
		// for example, searching for "*w*" will match
		// [[gonggong]] (mud wasp), Syn. [[sasata]] (bee)
		// because it finds the 'w' in 'wasp'
		// To counter this, use regex and replace * and ?  (% and _)
		// with regex captures that are anything except [ or ]
		// Also, use triple escape codes (\\\) to account for:
		// 		(1) PHP parser, (2) MariaDB parser, and (3) regex parser
		if ($has_special) {
			$q3 = str_replace("%","([^\\\[\\\]]*)",$q2);		//regex replacements -- anything that is not a [
			$q3 = str_replace("_","([^\\\[\\\]])",$q3);
			$sql = "SELECT * FROM diksionariu
						WHERE related_forms RLIKE '.*\\\[\\\[" . $q3 . "\\\]\\\].*'
						OR see_also RLIKE '.*\\\[\\\[" . $q3 . "\\\]\\\].*'";
		}
		
		$result = mysqli_query($db_connect, $sql);
		$results_array = array();
		
		// if any results from 'alternate_forms' or 'related_forms'
		if ($result->num_rows > 0) {
			while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
				$results_array[] = $row;
			}
			$results_array = mb_convert_encoding($results_array, "UTF-8");
			
			$insert_code = $insert_code . '<script>displayCHAltResults("' . $q . '",' . json_encode($results_array) . ');</script>';
			
			// free up the memory from the result set
			mysqli_free_result($result);
			
			return true;
		} else {
			return false;
		}
	}


	//*****************************************************
	// Search Partial Matches
	// (CHamoru) (Multiple-results)
	// 
	// If no results from related fields
	// Search 'entry' for partial matches
	//	- entries that contain the search term
	//	- entries contained in the search term
	// assuming at least 4 characters in the search query and entry
	//
	// Basic search ignores diacritics, caps, and ' -
	// Wildcard search is literal
	//
	// Returns:
	//	- list of partial-matched 'entry' values
	// 	- return_all_words() -- for fuzzy search
	//*****************************************************	
	function search_partial()
	{
		global $db_connect, $insert_code, $has_special, $q, $q2;
		
		// ignore apostrophes and dashes
		$sql = "SELECT DISTINCT entry FROM diksionariu "
			. "WHERE CHAR_LENGTH(entry) > 3 "
			. "AND CHAR_LENGTH('" . $q2 . "') > 3 "
			. "AND REPLACE(REPLACE('" . $q2 . "', '\'', ''), '-', '') "
			. "LIKE CONCAT('%',REPLACE(REPLACE(entry, '\'', ''), '-', ''),'%') "
			. "OR REPLACE(REPLACE(entry, '\'', ''), '-', '') "
			. "LIKE REPLACE(REPLACE('%" . $q2 . "%', '\'', ''), '-', '')";
		
		// if query contains space ' ' (phrases), include the exploded terms
		if (strpos($q2, ' ') !== false) {
			$words = explode(' ',$q2);	//split query into words
			$words_sql = "";
			foreach ($words as $word) {
				$words_sql .= "entry LIKE '" . $word . "' OR ";			//TODO -- is this correct? Final OR? maybe replace with: implode
			}
			$sql = "SELECT DISTINCT entry FROM diksionariu "
				. "WHERE " . $words_sql
				. "CHAR_LENGTH(entry) > 3 "
				. "AND CHAR_LENGTH('" . $q2 . "') > 3 "
				. "AND REPLACE(REPLACE('" . $q2 . "', '\'', ''), '-', '') "
				. "LIKE CONCAT('%',REPLACE(REPLACE(entry, '\'', ''), '-', ''),'%') "
				. "OR REPLACE(REPLACE(entry, '\'', ''), '-', '') "
				. "LIKE REPLACE(REPLACE('%" . $q2 . "%', '\'', ''), '-', '')";
		}
		
		// if query contains special characters, allow ' and -
		if ($has_special) {
			$sql = "SELECT DISTINCT entry FROM diksionariu "
				. "WHERE CHAR_LENGTH(entry) > 3 "
				. "AND CHAR_LENGTH('" . $q2 . "') > 3 "
				. "AND ( '" . $q2 . "' LIKE CONCAT('%', entry, '%') "
				. "OR entry LIKE '%" . $q2 . "%' )";
		}
		
		$result = mysqli_query($db_connect, $sql);
		$results_array = array();
		
		$results_array2 = get_all_words();
		
		// if any results from 'alternate_forms' or 'related_forms'
		if ($result->num_rows > 0) {
			while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
				$results_array[] = $row;
			}
			$results_array = mb_convert_encoding($results_array, "UTF-8");
			
			$insert_code = $insert_code .
				'<script>displayCHPartialResults("' . $q . '",'
				. json_encode($results_array) . ','
				. json_encode($results_array2) . ');</script>';
			
			// free up the memory from the result set
			mysqli_free_result($result);
			
			return true;
			
		} else {
			return false;
		}
	}


	//*****************************************************
	// String-Search in Definitions
	// (English) (Multiple-results)
	// 
	// Search for a given string in definitions
	// 
	// If q contains a space, also runs conjunction search
	//*****************************************************	
	function search_definitions()
	{
		global $db_connect, $insert_code, $specials, $sitename, $q, $q2;
		
		// save current search in page_settings to correctly show what was searched in the search box on the results page
		// take the query from the PHP address and place in the search entry box on the results page
		// and change the page title to reflect the search query
		$insert_code = $insert_code . 
			'<script>page_settings.current_search = "Eng";
			document.getElementById("search-tabs").children[1].classList.add("current");
			document.getElementById("search-tabs").children[0].classList.remove("current");
			document.getElementById("entry").classList.add("entry-english");
			document.getElementById("entry").value = "' . $q . '";
			if (document.getElementById("under-search-entry") !== null)  document.getElementById("under-search-entry").value =  "' . $q . '";
			document.getElementsByTagName("title")[0].innerHTML = "' . $q . '" + " - ' .  $sitename . '"; </script>';
		
		$sql = "SELECT * FROM diksionariu WHERE definition LIKE '%" . $q2 . "%' ORDER BY CHAR_LENGTH(definition)";
		
		// Return a partial SQL string for terms with spaces
		// formatting for additional conjunction search
		// OR (.. AND ..)
		$split_by_space = function($str) {
			global $q2;
			
			// trim and break apart by spaces
			$pieces = trim($q2);
			$pieces = explode(" ", $pieces);
			
			// SQL sub-query to return
			$return_str = "";
			
			// conjunction search
			$and_terms = [];
			for ($i = 0; $i < count($pieces); ++$i) {
				$and_terms[] = "definition LIKE '%" . $pieces[$i] . "%'";
			}
			$return_str .= " OR (" . implode(" AND ", $and_terms) . ")";
			
			return $return_str;
		};
		
		// if compound search  ":"
		// (compound search aaa:bbb  = CHamoru term, definition search)
		if (strpos($q2, ':') !== false) {
			// split string by :
			$pieces = explode(":", $q2);
			$pieces[0] = trim($pieces[0]);
			$pieces[1] = trim($pieces[1]);
			
			// Prepare definition search insert
			$def = 'WHERE definition LIKE "%' . $pieces[1] . '%" ';
			if (strpos($pieces[1], ' ') !== false) {
				$def .= $split_by_space($pieces[1]);
			}
				
			// for basic searches, ignore apostrophes and dashes
			$sql = 'SELECT * FROM diksionariu '
					. $def
					. 'AND REPLACE( REPLACE(entry, "\'", ""),  "-", "") '
					. 'LIKE REPLACE( REPLACE("' . $pieces[0] .  '", "\'", ""),  "-", "")';
			
			// However, if query contains wildcards or contains any special characters,
			// allow ' and - 	(i.e.: search as entered)
			// Start by going through specials and look to see if search string contains one of them
			$has_special = false;
			foreach ($specials as $special_char) {
				if (strpos($pieces[0], $special_char) !== false) {
					$has_special = true;
					break;
				}
			}
			// if query contains one of these, don't replace
			if ($has_special) {
				$sql = 'SELECT * FROM diksionariu '
						. $def
						. 'AND entry LIKE "' . $pieces[0] . '" ORDER BY CHAR_LENGTH(definition)';
			}

		// no compound search, but has spaces
		// run an exact search, followed by AND search, followed by OR search
		} elseif (strpos($q2, ' ') !== false) {
			
			$sql = 'SELECT * FROM diksionariu WHERE definition LIKE "%' . $q2 . '%" '
				. $split_by_space($q2)
				. 'ORDER BY CHAR_LENGTH(definition)';
		}

		$result = mysqli_query($db_connect, $sql);
		$resultsArray = array();

		if ($result->num_rows > 0) {
			while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
				$resultsArray[] = $row;
			}
			$resultsArray = mb_convert_encoding($resultsArray, "UTF-8");
			$insert_code = $insert_code . '<script>displayEngResults("' . $q . '",' . json_encode($resultsArray) . ');</script>';

			// free up the memory from the result set
			mysqli_free_result($result);
			
			return true;
			
		} else {
			// return something to ensure that a result was returned for debugging purposes
			$insert_code = $insert_code . '<script>displayEngResults("' . $q . '","0");</script>';
		}
	}
	
	
	//******************************************************
	// Return All Words
	//
	// Return an Object of all rows, with:
	// 'entry','alternate_forms','related_forms','see_also'
	// (Used for fuzzy search)
	//******************************************************
	function return_all_words($direct_fuzzy)
	{
		global $insert_code, $q, $sitename;
		
		$q = str_replace("≈","~",$q);	//put back tilde for render and JS
		
		// return a signifier of no results
		// and 'entries', 'alternate_forms', 'related_forms', 'see_also'
		// for fuzzy search extraction entries and terms from links [[..]]
		$results_array = get_all_words();
		if ($direct_fuzzy) {
			$insert_code = $insert_code . '<script>page_settings.current_search = "CH";
				document.getElementById("entry").value = "' . $q . '";
				if (document.getElementById("under-search-entry") !== null)  document.getElementById("under-search-entry").value =  "' . $q . '";
				document.getElementsByTagName("title")[0].innerHTML = "' . $q . '" + " - ' .  $sitename . '"; </script>';
			$insert_code = $insert_code .
				'<script>displayCHResults("' . $q . '",' .		// query
				'"0",' . 										// "0" (indicator of no results)
				'"",' .											// optional message
				json_encode($results_array) .					// all_words
				', "fuzzy");</script>';							// optional type
		} else {
			$insert_code = $insert_code .
				'<script>displayCHResults("' . $q . '",' .		// query
				'"0",' . 										// "0" (indicator of no results)
				'"",' .											// optional message
				json_encode($results_array) . ');</script>';	// all_words
		}
	}
	//*********************************
	// Helper function: Get all words
	// (also called by Partial Search)
	//*********************************
	function get_all_words()
	{
		global $db_connect;
		
		$sql = 'SELECT * FROM lookup WHERE lookup NOT LIKE "xx%"';
		
		$result = mysqli_query($db_connect, $sql);
		$results_array = array();
		
		if ($result->num_rows > 0) {
			while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
				$results_array[] = $row;
			}
			$results_array = mb_convert_encoding($results_array, "UTF-8");
			
			// free up the memory from the result set
			mysqli_free_result($result);	
		}
		
		return $results_array;
	}
	
	
	//******************************************************************************
	// Return Parse Query
	//
	// Not really necessary to have as a server call, since parsing is done locally
	// However, allows easy browser history navigation and also keeps a server log
	// of how often people are interacting with the webpage, which is nice for
	// records keeping
	//*******************************************************************************
	function return_parse_query()
	{
		global $insert_code, $q, $sitename;
		
		// set search box and title
		$insert_code = $insert_code . '<script>page_settings.current_search = "CH";
			document.getElementById("entry").value = "' . $q . '";
			if (document.getElementById("under-search-entry") !== null)  document.getElementById("under-search-entry").value =  "' . $q . '";
			document.getElementsByTagName("title")[0].innerHTML = "' . $q . '" + " - ' .  $sitename . '"; </script>';
		
		// return message to trigger morphological processing
		$insert_code = $insert_code .
				'<script>displayCHResults("' . $q . '",' .	// query
				'"0",' . 									// "0" (indicator of no results)
				'"",' .										// optional message
				'"",' .										// all_words
				'"parse");</script>';						// optional type
	}

	//********************
	// Return Null Result
	//********************
	function return_null_result()
	{
		global $insert_code, $q;
		
		// return something to ensure that a result was returned for debugging purposes
		$insert_code = $insert_code . '<script>displayCHResults("' . $q . '","0");</script>';
	}
	
	
	
	
	// Insert the accumulated code into HTML and echo out
	$html_template = str_replace('<!-- PHP inserts code here -->', $insert_code, $html_template);
	echo $html_template;
	
	// close connection 
	mysqli_close( $db_connect );
?>