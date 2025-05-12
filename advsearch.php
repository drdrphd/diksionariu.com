<?php
	require (__DIR__ . '/../private_html/diksionariuconfig.php');		//Defines: DB_SERVER, DB_USER, DB_PASS, DB_NAME
	header('Content-Type: text/html; charset=utf-8');
	
	$db_connect = mysqli_connect(DB_SERVER, DB_USER, DB_PASS, DB_NAME);

	if (mysqli_connect_errno()) {
		echo '<script>document.getElementById("advanced-results").innerHTML = "Could not connect to database: \n' . mysqli_connect_error() . '";</script>';
		exit();
	}
	
	mysqli_set_charset($db_connect, 'utf8mb4');
	$specials = ['Å','Á','É','Í','Ó','Ú','á','é','í','ó','ú','å','Ñ','ñ','-',"'",'%','_'];
	
	//extract variables from query, put into associative array
	//(encoding/decoding helps with issues with diacritics)
	$q0 = array(
		'q' => urldecode(strval($_GET['q'])),					//entry
		'alternate_forms' => urldecode(strval($_GET['a'])),		//alternate spellings
		'definition' => urldecode(strval($_GET['d'])),			
		'examples' => urldecode(strval($_GET['e'])),				
		'notes' => urldecode(strval($_GET['n'])),				//(m/f), dialectal, vulgar, etc.
		'origin' => urldecode(strval($_GET['o'])),				//etymology
		'part_of_speech' => urldecode(strval($_GET['p'])),		//(from drop-down)
		'related_forms' => urldecode(strval($_GET['r'])),		//words with the same root, different affixes
		'see_also' => urldecode(strval($_GET['c'])),			//synonyms, antonyms, other similar words
		'source' => urldecode(strval($_GET['s'])),				//DCA dictionary, persons initials, etc.
		'contextual_example' => urldecode(strval($_GET['x']))	//Contextual examples with audio
	);
	
	//sanitize
	foreach($q0 as $key => &$value) {
		$value = mb_convert_encoding($value, "UTF-8");
		$value = str_replace(['‘', '’'], "'", $value);		//change all curly apostrophes to regular apostrophes

		//this is where you would add a select-box for exact search (i.e., if(approx) exclude - ' in next lines)
		$value = preg_replace('/[^a-zA-ZÅÁÉÍÓÚáéíóúåÑñ \.\-\'*?]+/', ' ', $value);	//Only take alphabetic, lona', n-tilde, accented letters, space, period, dash, glotta, and wildcards * ?
	}
	
	// copy to a second array (to return the cleaned original,
	// but to also make some additional SQL-readable changes)
	$q = $q0;
	foreach($q as $key => &$value) {
		//escape-code apostrophes
		$value = str_replace("'","''",$value);
		
		//change wildcards to the appropriate SQL wildcards
		$value = str_replace("*","%",$value);
		$value = str_replace("?","_",$value);
	}
	
	
	// function hasSpecial(string, array)
	//
	// checks to see if the string contains
	// any of the characters in the array
	// 
	// returns bool
	//
	function hasSpecial($str, $special) {
		//Check to see if $q has any special characters
		//If so, we'll include - and ' in the search matching
		foreach ($special as $special_char) {
			if (strpos($str, $special_char) !== false) {
				return true;
			}
		}
		return false;
	}
	

	//create search strings for each of the variables
	//
	// structure for each variable
	//		check if there's anything in the blank (is_null)
	//		? if not, accept anything for that search term
	//		: if so,  check for wildcards
	//			? if so, exact search
	//			: if not, search while disregarding - '
	//
	$q2 = array(
		'q' => empty($q['q'])
				? "entry LIKE '%%'"
				: ((hasSpecial($q['q'],$specials) == true)
					? "entry LIKE '" . $q['q'] . "'"
					: "REPLACE(REPLACE(entry, \"'\", ''), \"-\", '') LIKE REPLACE(REPLACE('" . $q['q'] . "', \"'\", ''), \"-\", '')"),
		'alternate_forms' => empty($q['alternate_forms'])
				? "alternate_forms LIKE '%%'"
				: ((hasSpecial($q['alternate_forms'],$specials) == true)
					? "alternate_forms LIKE '%" . $q['alternate_forms'] . "%'"
					: "REPLACE(REPLACE(alternate_forms, \"'\", ''), \"-\", '') LIKE REPLACE(REPLACE('%" . $q['alternate_forms'] . "%', \"'\", ''), \"-\", '')"),
		'definition' => empty($q['definition'])
				? "definition LIKE '%%'"
				: ((hasSpecial($q['definition'],$specials) == true)
					? "definition LIKE '%" . $q['definition'] . "%'"
					: "REPLACE(REPLACE(definition, \"'\", ''), \"-\", '') LIKE REPLACE(REPLACE('%" . $q['definition'] . "%', \"'\", ''), \"-\", '')"),
		'examples' => empty($q['examples'])
				? "examples LIKE '%%'"
				: ((hasSpecial($q['examples'],$specials) == true)
					? "examples LIKE '%" . $q['examples'] . "%'"
					: "REPLACE(REPLACE(examples, \"'\", ''), \"-\", '') LIKE REPLACE(REPLACE('%" . $q['examples'] . "%', \"'\", ''), \"-\", '')"),
		'notes' => empty($q['notes'])
				? "notes LIKE '%%'"
				: ((hasSpecial($q['notes'],$specials) == true)
					? "notes LIKE '%" . $q['notes'] . "%'"
					: "REPLACE(REPLACE(notes, \"'\", ''), \"-\", '') LIKE REPLACE(REPLACE('%" . $q['notes'] . "%', \"'\", ''), \"-\", '')"),
		'origin' => empty($q['origin'])
				? "origin LIKE '%%'"
				: ((hasSpecial($q['origin'],$specials) == true)
					? "origin LIKE '%" . $q['origin'] . "%'"
					: "REPLACE(REPLACE(origin, \"'\", ''), \"-\", '') LIKE REPLACE(REPLACE('%" . $q['origin'] . "%', \"'\", ''), \"-\", '')"),
		'part_of_speech' => empty($q['part_of_speech'])
				? "part_of_speech LIKE '%%'"
				: ((hasSpecial($q['part_of_speech'],$specials) == true)
					? "part_of_speech LIKE '%" . $q['part_of_speech'] . "%'"
					: "REPLACE(REPLACE(part_of_speech, \"'\", ''), \"-\", '') LIKE REPLACE(REPLACE('%" . $q['part_of_speech'] . "%', \"'\", ''), \"-\", '')"),
		'related_forms' => empty($q['related_forms'])
				? "related_forms LIKE '%%'"
				: ((hasSpecial($q['related_forms'],$specials) == true)
					? "related_forms LIKE '%" . $q['related_forms'] . "%'"
					: "REPLACE(REPLACE(related_forms, \"'\", ''), \"-\", '') LIKE REPLACE(REPLACE('%" . $q['related_forms'] . "%', \"'\", ''), \"-\", '')"),
		'see_also' => empty($q['see_also'])
				? "see_also LIKE '%%'"
				: ((hasSpecial($q['see_also'],$specials) == true)
					? "see_also LIKE '%" . $q['see_also'] . "%'"
					: "REPLACE(REPLACE(see_also, \"'\", ''), \"-\", '') LIKE REPLACE(REPLACE('%" . $q['see_also'] . "%', \"'\", ''), \"-\", '')"),
		'source' => empty($q['source'])
				? "source LIKE '%%'"
				: ((hasSpecial($q['source'],$specials) == true)
					? "source LIKE '%" . $q['source'] . "%'"
					: "REPLACE(REPLACE(source, \"'\", ''), \"-\", '') LIKE REPLACE(REPLACE('%" . $q['source'] . "%', \"'\", ''), \"-\", '')"),
		'contextual_example' => ($q['contextual_example'] == 'true')
				? "context_examples NOT LIKE ''"
				: "context_examples LIKE '%'",
	);

	
	//this is a bit awkward due to the IF statements above, but seems more readable than doing it all at once
	//also line breaks were showing up in the query (FROM diksionariu/r/n/t/t WHERE ...) so formatting is a bit ugly :'(
	$sql = "SELECT * FROM diksionariu WHERE " . $q2['q'] . " AND " . $q2['alternate_forms'] . " AND " . $q2['definition'] . " AND " . $q2['examples'] . " AND " . $q2['notes'] . " AND " . $q2['origin'] . " AND " . $q2['part_of_speech'] . " AND " . $q2['related_forms'] . " AND " . $q2['see_also'] . " AND " . $q2['source'] . " AND " . $q2['contextual_example'] . " " ;

	
	$result = mysqli_query($db_connect, $sql);
	$results_array = array();

	if ($result->num_rows > 0) {
		while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
			$results_array[] = $row;
		}
		$results_array = mb_convert_encoding($results_array, "UTF-8");
		
		echo json_encode($q0) . '¶' . json_encode($results_array);	//return query terms and results, split by ¶
		
	} else {
		//return something to ensure that a result was returned for debugging purposes
		echo "0";
	}
	
	// free up the memory from the result set
	// (a null result returns FALSE, free_result gives error for BOOL values, so check if set first)
	if (isset($result) && is_resource($result))  mysqli_free_result($result);
	
	// close connection 
	mysqli_close( $db_connect );
?>
