<?php
	require (__DIR__ . '/../private_html/diksionariuconfig.php');		//Defines: DB_SERVER, DB_USER, DB_PASS, DB_NAME
	header('Content-Type: text/html; charset=utf-8');
	
	$db_connect = mysqli_connect(DB_SERVER, DB_USER, DB_PASS, DB_NAME);

	if (mysqli_connect_errno()) {
		echo '<script>document.getElementById("full-download").innerHTML = "Could not connect to database: \n' . mysqli_connect_error() . '";</script>';
		exit();
	}
	
	mysqli_set_charset($db_connect, 'utf8');
	

	//****************
	// Download Table 
	//****************		
	$sql = "SELECT * FROM diksionariu";
		
	$result = mysqli_query($db_connect, $sql);
	$results_array = array();

	if ($result -> num_rows > 0) {
		while($row = mysqli_fetch_array($result, MYSQLI_ASSOC)) {
			$results_array[] = $row;
		}
		$results_array = mb_convert_encoding($results_array, "UTF-8");
		
		echo json_encode($results_array);
		
	} else {
		//return something to ensure that a result was returned for debugging purposes
		echo '0';
	}
	
	// free up the memory from the result set
	mysqli_free_result($result);
	
	
	// close connection 
	mysqli_close( $db_connect );
?>
