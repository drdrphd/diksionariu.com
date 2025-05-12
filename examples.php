<?php
	require (__DIR__ . '/../private_html/diksionariuconfig.php');
	header('Content-Type: text/html; charset=utf-8');
	
	$db_connect = mysqli_connect(DB_SERVER, DB_USER, DB_PASS, DB_NAME);
	mysqli_set_charset($db_connect, 'utf8');

	if (mysqli_connect_errno()) {
		echo 'Could not connect to database: \n' . mysqli_connect_error();
		exit();
	}
	
	//extract variables from query
	$q = json_decode(urldecode($_GET['q']));	//array of example IDs
	
	//sanitize
	foreach($q as $value) {
		$value = mb_convert_encoding($value, "UTF-8");
		//Only take alphanumeric
		$value = preg_replace('/\W+/', '', $value);
	}
	
	
	//Assemble SQL command
	$sql = "SELECT * FROM examples WHERE id IN (" . implode(',', $q) . ")";

	
	$result = mysqli_query($db_connect, $sql);
	$results_array = array();

	if ($result->num_rows > 0) {
		while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
			$results_array[] = $row;
		}
		$results_array = mb_convert_encoding($results_array, "UTF-8");
		
		echo json_encode($results_array);	//return results
		
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