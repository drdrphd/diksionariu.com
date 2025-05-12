<?php
	require (__DIR__ . '/../private_html/diksionariuconfig.php');
	header('Content-Type: text/html; charset=utf-8');
	
	mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT); // Enable strict mode
	
	//global error catching
	try {
		$db_connect = mysqli_connect(DB_SERVER, DB_USER, DB_PASS, DB_NAME);

		mysqli_set_charset($db_connect, 'utf8mb4');

		//get parameters from submitted query
		$q 	= (isset($_GET['q'])) ? urldecode(strval($_GET['q'])) : "";	//query (encoding/decoding helps with issues with diacritics)

		//sanitize
		$q2 = mb_convert_encoding($q, "UTF-8");
		$q2 = str_replace(['‘', '’'], "'", $q2);		//change all curly apostrophes to regular apostrophes
		$q2 = preg_replace('/[^0-9a-zA-ZÅÁÉÍÓÚáéíóúåÑñ \.\-\'*?≈:]+/', ' ', $q2);	//Only take alphanumeric, lona', n-tilde, accented letters, space, period, dash, glotta, and wildcards * ? ~ :
		
		//change wildcards to the appropriate SQL wildcards
		$q2 = str_replace("*","%",$q2);
		$q2 = str_replace("?","_",$q2);
		
		
		//get up to 10 items from lookup table (except for xxx entries, which are waiting for garbage collection)
		//start with terms that start with $q, and if less than 10, add terms that have $q anywhere
		//ignore glotta (')
		if (strpos($q2, "'") !== false) {
			$sql = "SELECT * FROM lookup WHERE "
				. "lookup LIKE \"" . $q2 .  "%\" "
				. "AND lookup NOT LIKE \"xx%\" "
				. "ORDER BY CHAR_LENGTH(lookup) ASC, lookup ASC LIMIT 10";
		} else {
			$sql = "SELECT * FROM lookup WHERE "
				. "REPLACE(lookup, \"'\", \"\") "
				. "LIKE REPLACE(\"" . $q2 .  "%\", \"'\", \"\") "
				. "AND lookup NOT LIKE \"xx%\" "
				. "ORDER BY CHAR_LENGTH(lookup) ASC, lookup ASC LIMIT 10";
		}
		$result = mysqli_query($db_connect, $sql);
		$results_array = array();
		while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
			$results_array[] = $row;
		}
		if (count($results_array) < 10) {
			if (strpos($q2, "'") !== false) {
				$sql = "SELECT * FROM lookup WHERE "
					. "lookup LIKE \"" . $q2 .  "%\" "
					. "AND lookup NOT LIKE \"xx%\" "
					. "ORDER BY CHAR_LENGTH(lookup) ASC, lookup ASC LIMIT 10";
			} else {
				$sql = "SELECT * FROM lookup WHERE "
						. "REPLACE(lookup, \"'\", \"\") "
						. "LIKE REPLACE(\"%" . $q2 .  "%\", \"'\", \"\") "
						. "AND lookup NOT LIKE \"xx%\" "
						. "ORDER BY CHAR_LENGTH(lookup) ASC, lookup ASC LIMIT 10";
			}
			$result = mysqli_query($db_connect, $sql);
			$results_array2 = array();
			while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
				$results_array2[] = $row;
			}
			
			//take only elements not in the first array
			function merge_function($a, $b) {
			    return  ($a['lookup_key'] <=> $b['lookup_key']); }
			$results_array2 = array_udiff($results_array2, $results_array, 'merge_function');
			$results_array = array_merge($results_array, $results_array2);
		}
		
		//sort results by length (short to long)
		usort($results_array, function($a, $b) {
			return strlen($a['lookup_key']) <=> strlen($b['lookup_key']);
		});
		//trim to 10 results
		$results_array = array_slice($results_array, 0, 10);
		
		//encode and echo out
		echo json_encode($results_array);

		// free up the memory from the result set
		mysqli_free_result($result);
		
		//close connection 
		mysqli_close($db_connect);
	
	
	//catch and log any errors
	} catch (mysqli_sql_exception $e) {
		error_log($e->getMessage());
		echo '<script>document.getElementById("feedback").innerHTML = "Error connecting to database: \n' . $e->getMessage() . '\nTry again or contact webmaster with error.";</script>';
	}
?>