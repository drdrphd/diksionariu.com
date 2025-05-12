<?php
	header('Content-Type: text/html; charset=utf-8');
	
	require (__DIR__ . '/../private_html/diksionariuconfig.php');		//Defines: DB_SERVER, DB_USER, DB_PASS, DB_NAME
	
	//Load the main.html template into a variable
	ob_start();
	include 'wotd.html';
	$html_template = ob_get_clean();
	
	//eventual code to insert into template
	$insert_code = "";
	
	//get passed date
	$wotd_date = (isset($_GET['d'])) ? strval($_GET['d']) : "0";	//passed "yyyy-mm-dd" format string
	
	//if no date passed, print error and exit
	if ($wotd_date == "0") {
		$html_template =
			str_replace('<!-- PHP inserts code here -->',
						'<script>document.getElementById("wotd-card").innerHTML = "<div class=\"no-result\">Error: No date provided</div>";</script>',
						$html_template);
		echo $html_template;
		exit();
	}
	
	//sanitize
	$wotd_date = preg_replace('/[^0-9\-]+/', '', $wotd_date);	//Only take numeric and -
	
	
	//*********************
	//* Connect to Server *
	//*********************
	$db_connect = mysqli_connect(DB_SERVER, DB_USER, DB_PASS, DB_NAME);

	if (mysqli_connect_errno()) {
		$html_template =
			str_replace('<!-- PHP inserts code here -->',
						'<script>document.getElementById("wotd-card").innerHTML = "Could not connect to database: \n' . mysqli_connect_error() . '";</script>',
						$html_template);
		echo $html_template;
		exit();
	}
	
	mysqli_set_charset($db_connect, 'utf8');


	//***********************
	//* Get Word of the Day
	//* and insert into Main
	//***********************
	
	//set local timezone to Chamorro Standard Time
	date_default_timezone_set('Pacific/Guam');
	$current_date = new DateTime('now');
	
	$wotd_date = new DateTime($wotd_date);	//convert to DateTime object
	if ($wotd_date > $current_date)  $wotd_date = $current_date;	//do not allow retrieval of future words
	$wotd_tomorrow = clone $wotd_date;
	$wotd_yesterday = clone $wotd_date;
	date_modify($wotd_tomorrow, '+1 day');
	date_modify($wotd_yesterday, '-1 day');
	$wotd_tomorrow_exists = false;
	$wotd_yesterday_exists = false;
	
	$return_date = date_format($wotd_date, "l, F j, Y");	//formatted for page injection (e.g. Wednesday, March 3, 2010)
	
	//Get the target date
	$sql = "SELECT * from wotd WHERE date = '" . $wotd_date->format('Y-m-d') . "'";
	$result = mysqli_query($db_connect, $sql);
	if ($result->num_rows > 0) {
		$row = mysqli_fetch_assoc($result);
		
		$wotd_entry = $row['entry'];
		$wotd_entry = mb_convert_encoding($wotd_entry, "UTF-8");
		$wotd_hashes = $row['entry_index'];
		$wotd_categories = $row['categories'];
	
	//if no results
	} else {
		$html_template =
			str_replace('<!-- PHP inserts code here -->',
						'<script>document.getElementById("wotd-card").innerHTML = "<div class=\"no-result\">Error: Day out of range</div>";</script>',
						$html_template);
		echo $html_template;
		exit();
	}
	
	//check for "tomorrow"
	$sql = "SELECT 1 from wotd WHERE date = '" . $wotd_tomorrow->format('Y-m-d') . "'";	//no results (not found) or one result (found)
	$result = mysqli_query($db_connect, $sql);
	if (($result->num_rows > 0) && ($wotd_tomorrow <= $current_date)) {
		$wotd_tomorrow_exists = true;
	}
	
	//check for "yesterday"
	$sql = "SELECT 1 from wotd WHERE date = '" . $wotd_yesterday->format('Y-m-d') . "'";	//no results (not found) or one result (found)
	$result = mysqli_query($db_connect, $sql);
	if ($result->num_rows > 0) {
		$wotd_yesterday_exists = true;
	}
	
	
	//Now retrieve the entry/entries listed
	$sql = 'SELECT * FROM diksionariu WHERE entry LIKE "' . $wotd_entry . '"';
	if (strlen($wotd_hashes) > 0) {
		$sql = "SELECT * FROM diksionariu WHERE ";
		$hashes = explode(",", $wotd_hashes);
		foreach ($hashes as &$value) {
			$sql .= "hashed_entry LIKE '" . $value . "' OR ";
		}
		$sql = substr($sql, 0, -4);  //trim off last " OR "
	}
	
	$result = mysqli_query($db_connect, $sql);
	$resultsArray = array();
	if ($result->num_rows > 0) {
		while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
			$resultsArray[] = $row;
		}
		$resultsArray = mb_convert_encoding($resultsArray, "UTF-8");
		foreach ($resultsArray as &$res) {
			$insert_code .=
				"<script>document.getElementById('results').innerHTML"
				. "+= formatSingleResult("
				. json_encode($res)
				. ", header=false);</script>";
		}
	}
	
	mysqli_free_result($result);
	
	function chamorricize_date($str)
	{
		$str = str_replace('Sunday', 'Damenggo', $str);
		$str = str_replace('Monday', 'Lunes', $str);
		$str = str_replace('Tuesday', 'Måttes', $str);
		$str = str_replace('Wednesday', 'Metkoles', $str);
		$str = str_replace('Thursday', 'Huebes', $str);
		$str = str_replace('Friday', 'Betnes', $str);
		$str = str_replace('Saturday', 'Såbalu', $str);
		
		$str = str_replace('January', 'Eneru', $str);
		$str = str_replace('February', 'Febreru', $str);
		$str = str_replace('March', 'Måtso', $str);
		$str = str_replace('April', 'Abrit', $str);
		$str = str_replace('May', 'Måyu', $str);
		$str = str_replace('June', 'Hunio', $str);
		$str = str_replace('July', 'Hulio', $str);
		$str = str_replace('August', 'Agosto', $str);
		$str = str_replace('September', 'Septembre', $str);
		$str = str_replace('October', 'Oktubre', $str);
		$str = str_replace('November', 'Nubembre', $str);
		$str = str_replace('December', 'Disembre', $str);
		
		return $str;
	}
	
	//Insert indexes into HTML and echo out
	$html_template = str_replace('<!-- PHP inserts code here -->', $insert_code, $html_template);
	$html_template = str_replace('<!-- PHP replace date -->', chamorricize_date($return_date), $html_template);
	$html_template = str_replace('<!-- PHP replace wotd -->', $wotd_entry, $html_template);
	if ($wotd_yesterday_exists) $html_template = str_replace('<!-- PHP replace yesterday -->', '<a href="/fh.php?d=' . $wotd_yesterday->format('Y-m-d') . '"><div class="adjacent-days yesterday"></div></a>', $html_template);
	if ($wotd_tomorrow_exists)  $html_template = str_replace('<!-- PHP replace tomorrow -->',  '<a href="/fh.php?d=' . $wotd_tomorrow->format('Y-m-d')  . '"><div class="adjacent-days tomorrow"></div></a>', $html_template);
	echo $html_template;

	//Close connection 
	mysqli_close( $db_connect );
?>
