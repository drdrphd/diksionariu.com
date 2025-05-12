<?php
	header('Content-Type: text/html; charset=utf-8');
	
	require (__DIR__ . '/../private_html/diksionariuconfig.php');		//Defines: DB_SERVER, DB_USER, DB_PASS, DB_NAME
	
	//Load the main.html template into a variable
	ob_start();
	include 'main.html';
	$html_template = ob_get_clean();
	
	
	//*********************
	//* Connect to Server *
	//*********************
	$db_connect = mysqli_connect(DB_SERVER, DB_USER, DB_PASS, DB_NAME);

	if (mysqli_connect_errno()) {
		$html_template =
			str_replace('<!-- PHP inserts code here -->',
						'<script>document.getElementById("main-page-browse").innerHTML = "Could not connect to database: \n' . mysqli_connect_error() . '";</script>',
						$html_template);
		echo $html_template;
		exit();
	}
	
	mysqli_set_charset($db_connect, 'utf8mb4');
	


	//***********************
	//* Get Word of the Day
	//* and insert into Main
	//***********************
	
	//set local timezone to Chamorro Standard Time
	date_default_timezone_set('Pacific/Guam');
	$current_date = date("Y-m-d");	//yyyy-mm-dd		(for SQL retrieval)
	$return_date = date("l, F j, Y");	//Wednesday, March 3, 2010		(for page injection)
	
	$sql = "SELECT * from wotd WHERE date = '" . $current_date . "'";
	
	$result = mysqli_query($db_connect, $sql);
	if ($result->num_rows > 0) {
		$word = mysqli_fetch_assoc($result)['entry'];
		$word = mb_convert_encoding($word, "UTF-8");
		
		//quote out the page's default values
		$html_template = str_replace('<!-- PHP quote-out start -->', '<!--', $html_template);
		$html_template = str_replace('<!-- PHP quote-out end -->', '-->', $html_template);
		
		//format code to insert
		$insert_wotd =
			'<a href="\fh.php?d=' . $current_date . '">'
				. '<div class="wotd">' . $word . '</div>'
				. '<div class="wotd-sub">Definitions & More</div>'
			. '</a>';
		
		//insert in template
		$html_template = str_replace('<!-- PHP WOTD insert here -->', $insert_wotd, $html_template);
	}
	
	mysqli_free_result($result);
	
	

	//***************************
	//* Get the letter indexes
	//* and return to main JS
	//***************************
	//***** Below should go in its own PHP file, probably *****
	//***** currently duplicated in multiple search -- update both if still in two places
	
	//Get letter indexes and store as a global
	$sql = "SELECT MIN(index_num) AS start_index, 
			IF(LEFT(entry, 1) = '-', SUBSTRING(entry, 2, 1), LEFT(entry, 1)) AS letter
			FROM diksionariu
			GROUP BY letter COLLATE utf8mb4_unicode_ci
			ORDER BY letter ASC";
		
	$result = mysqli_query($db_connect, $sql);
	$resultsArray = array();
	
	if ($result->num_rows > 0) {
		while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
			$resultsArray[] = $row;
		}
		$resultsArray = mb_convert_encoding($resultsArray, "UTF-8");
		$insert_indexes = 
			  '<script>
				const letter_indexes = ' . json_encode($resultsArray) . ';
				populateBrowseByLetter();
			  </script>';
	}
	
	mysqli_free_result($result);
	
	//Insert indexes into HTML and echo out
	$html_template = str_replace('<!-- PHP inserts code here -->', $insert_indexes, $html_template);
	echo $html_template;

	//Close connection 
	mysqli_close( $db_connect );
?>
