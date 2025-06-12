# diksionariu.com

Source code of [diksionariu.com](https://diksionariu.com/), an online CHamoru-English dictionary

## Table of Contents

- [About](#about)
- [Features](#features)
- [License](#license)

## About

The dictionary was developed to access dictionary data quickly and helpfully.
Connects to a MySQL database with a few specified tables.
Although designed for CHamoru, it can easily be adapted to other languages.

Work in progress, so some elements may be buggy.

## Features

Includes:

- Search
  - Basic Search (including wildcard and alternate fields)
  - Advanced Search (all fields)
  - Fuzzy Search (using a modified Levenshtein distance)
  - Compound Search
    * Entry:Definition
    * Entry::Example
- Morphological Stemming / Parsing tools (developed in parallel, so has different version numbers)
- Hover Pop-up for lookups & morphology
- Wikipedia-similar formatting for markdown
  - ```~~italics~~``` for *italics*
  - ```'''bold'''``` for **bold**
  - ```[[link]]``` for internal links, or
  - ```[[link|url]]``` for external links
- Integrated Audio examples from our documentation project, [chachalani.com](https://chachalani.com/)
- Word of the Day (*Finiho' Ha'åni*) with special formatting

## License

Distributed under a GNU General Public License v3.0

Feel free to use and improve as you see fit.
