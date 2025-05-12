///
///	compile-tries.js		--		Current version v.035, 2024-08-08
///
///	(trie (reTRIEval tree) tools)
///
/// Used to compile the initial retreival trees
///	(turns out to be lighter than pre-compiling and serving)
///	(May also, at some point, make dynamic after an SQL call to grab all entries)
///
/// Summary: takes an array of words or affixes
///		and breaks them down character-by-character
///		into a search tree
///
///	Methods:
///		class TrieNode		(constructor)
///		class Trie			(constructor)
///			insert(string, (..))		(add new word to trie, with optional properties*)
///			lastNode(string)			(if trie includes word, what's the last node of the word?)
///			includes(string, (..))		(does trie include this whole word?)
///			matchPattern(string)		(return Array of all results starting with search term)
///			remove(string, (..))		(remove word from trie, with optional properties)
///			
///			*properties -- agnostic to type;  can be String, Object, etc.
///
/// Code modeled after: https://learnersbucket.com/tutorials/data-structures/trie-data-structure-in-javascript/
///


//
// Class: TrieNode
//
// Constructor for nodes
//
// Contains:
//		Object ch			(children)
//		Numeric end			(end-of-word marker, 0|1)
//		Object pr			(properties)
//
class TrieNode {
	constructor() {
		this.ch = {};	//children
		this.end = 0;	//0|1
		this.pr = [];	//array of properties for the word or affix (allows multiples with same spelling)
	}
}

//
// Class: Trie
//
// Constructor for Trie object
//
// Contains:
//		root constructor
//
// Methods:
//		insert(word)
//		includes(word)			(search the trie for whole matches)
//		matchPattern(word)		(search and return words starting with the pattern) (for type-as-you-go)
//
class Trie {
	
	//trie roots have no key, just children
	constructor() {
		this.root = new TrieNode();
	}
	
	//
	// insert(String, (properties))
	//
	// Adds a word into the trie
	//	 letter-by-letter into nodes
	// Last letter sets 'end' to 1 (true)
	//
	insert(word, properties = null) {
		//start at the root
		var node = this.root;
		
		//go through word letter-by-letter
		for (var i = 0; i < word.length; i++) {
			
			//check if letter node doesn't yet exist
			if (!node.ch[word[i]]) {
				//if not, create
				node.ch[word[i]] = new TrieNode();
			}
			
			//enter the node and continue (to next letter)
			node = node.ch[word[i]];
		}
		
		//mark last visited node as 'end' and store add'l info (if present)
		node.end = 1;
		if (Boolean(properties)) node.pr.push(properties);
	}
	
	//
	// lastNode(String)
	//
	// Search the tree to find a match (exact and partial, both ok)
	//	 Take search term letter by letter,
	//	 Start at root, children includes letter?
	//	 fail, or continue to that node + children recursively
	//
	// Returns Object node	(last node of the word | the root node if failure)
	//
	lastNode(search) {
		//start at the root
		var node = this.root;
		
		//go through search string letter-by-letter
		for (var i = 0; i < search.length; i++) {
			
			//if letter is not in children, return FALSE
			if (!node.ch[search[i]]) {
				return this.root;
			}
			//otherwise, enter child node & continue
			node = node.ch[search[i]];
		}
		
		//return last node visited
		return node;
	}
	
	//
	// includes(String, (Object))
	//
	// wraps around wordNode(..) to return a Boolean
	//
	// Returns Boolean	(success | failure)
	//
	includes(search, properties = null) {
		
		var node = this.lastNode(search);
		
		//Did we find a partial word?
		//Is our returned node an end-node?  (Opt: Does it include the right properties?)
		if (node.end == 1) {
			if (Boolean(properties)) {
				if (node.pr.includes(properties))  return true;
				return false;
			}
			return true;
		}
		return false;
	}
	
	
	
	//
	// matchPattern(String)
	//
	// Search the tree to find words starting with the search string
	//	(optionally returns properties with matches)
	//
	// Returns either:
	//		FALSE 	(if no matches) or
	//		Array[string, string, ...]
	//
	matchPattern(search, get_properties = false) {
		
		var results = [];
		var word = "";		//assemble word as we go through nodes
		
		//recursive function called later...
		//get all combos of children from a given node
		function getAllWords(node, word) {
			//if we're at an end node, add to list (possibly with properties)
			if (node.end == 1) {
				if (get_properties) {
					for (var i = 0; i < node.pr.length; i++) {
						results.push([word, node.pr[i]]);
					}
				} else {
					results.push(word);
				}
			}
			//recursively go through children
			for (var child in node.ch) {
				getAllWords(node.ch[child], word + child);
			}
		}
		
		
		//start at the root
		var node = this.root;
		
		//go through search string letter-by-letter
		for (var i = 0; i < search.length; i++) {
			
			//if letter is not in children, return FALSE
			if (!node.ch[search[i]]) {
				return false;
			}
			//otherwise, add letter to word, enter child node & continue
			word += search[i];
			node = node.ch[search[i]];
		}
		
		//now get all combos of children from this node
		getAllWords(node, word);
		
		return results;
	}
	
	
	//
	// remove(String, (Object))
	//
	// Remove a given word from the tree
	//	(optional: that has the given properties)
	//
	// Test if word is in trie
	// If so, take whole word
	//	 search to last letter
	//	 If children,
	//		check if properties are the same and there aren't others
	//		if so, end = 0
	//	 	then backtrack...
	//		recurse on word[length-1]
	//		  if end = 1, return
	//		  otherwise, remove word[length] from children and recurse
	//
	// Returns:
	//		Boolean (success | failure)
	//
	remove(word, properties = null) {
		//reject empty search blanks
		if(!word) throw new Error("No word submitted");
		
		//get last node of word
		var node = this.lastNode(word, properties);
		
		//throw error if word not in trie
		if(node == this.root) throw new Error("Word not found");
		
		
		//recursively sever links to nodes that:
		//	- have no children
		//	- aren't end nodes
		const clearNodes = (word, letter) => {
			var mid_node = this.lastNode(word);
			delete mid_node.ch[letter];
			
			if (Object.keys(mid_node.ch).length == 0  &&  !mid_node.end ) {
				clearNodes(word.substring(0, word.length-1), word[word.length-1]);
			}
		};


		//if there are other properties, just delete the ones we want, done
		if (node.pr.length > 1) {
			var a = node.pr.indexOf(properties);	//indexOf(p) = -1 when p is null
			if (a > -1) node.pr.splice(a,1);
			return true;
		}
		//otherwise, delete info (not end, no properties)
		if (node.pr.length < 2) {
			node.end = 0;
			node.pr = [];
		}
		//now, if there are children, we're done
		if (Object.keys(node.ch).length > 0) {
			return true;
		}
		//otherwise, delete nodes above if this is no longer an end node
		if (!node.end) {
			clearNodes(word.substring(0, word.length-1), word[word.length-1]);
		}
	}
}