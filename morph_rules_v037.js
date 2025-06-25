// Note:
// At some point I would like to re-write this to just take the hunspell affix file and parse that as input
// In the meantime, just take the rules
//
//
// Affix Ordering Rules --
//	Affixes and Words will have /## codes after them (in affix file and word list). This will dictate which affixes can combine.
//	For example, man- (plural agreement) is one of the last prefixes you can add. The only thing after that
//	is vowel fronting. So the prefix will be listed as man/05, showing that the only Affix class that can attach
//	to it is class 05 -- listed below as 'Vowel Fronting'. Vowel Fronting itself will have class /00, which
//	allows nothing to attach. (Non-affixing words, currently separate, may later be defined as /00 type if combined.)
//	Another way to read this is, consider passive infixing -- once you've infixed, what affixes can attach? <in> points to /06
//	which includes agreement and vowel fronting. You don't have to have agreement to have vowel fronting, so both are listed.
//	Duplicate morphemes are filtered out programmatically later.
//	
// 
// Ordering Rules from Topping:
// (Vowel Fronting) ( Plural ( Infixation / [Prefixes]** ( Reduplication ( Antipassive ((ROOT) Suffixation* )))))))
// Suffixation = ((((ROOT) Suffixes ) Linker ) -ñaihon ) Possessive Pronoun Clitics
//
// Errors in Topping -- ké- and lá- occur before reduplication    (What about: gé'- and ká- ?)
//						lá- after hát- (lálattalom), lá- after gof- (lágefsaga)
//						á- RECIP happens before ANTIP
//						fa'- happens before ANTIP (mama'- = man- + fa'-)
//						Suffixes happen after prefixes (steal stress from stress-stealing prefixes)
//						Infixing after Inner suffixes (pinalakse'guan ('slip of the tongue') = <in> (nominal infix) + palakse' ('slippery') + -guan (suffix, 'accidental'))
//						See Chung (p.694) for Progressive ordering
//
// Fixed Ordering:
//	(Vowel Fronting - BL) ((Agreement - A1,AC,B9  (<IN> - A0  (Reduplication - A2 ((([Prefixes] - A4,A6,A9,AB,AF,AW,AX,AY,AZ,B5,B7,BC,BD
//			... (Passive & Antipassive - AD,B3,B4,A8 ([Prefixes] - A3,A5,A7,AA,AE,B2 ( [Directional Prefixes] B0,B1,B6,BE,BF,BJ,BK (ROOT
//			... ROOT)))))  Suffixes ) Linker, -ñaihon, Possessive Clitics - BA,AJ,AM-AT)))) Intensifying Reduplication(?) )
//
// TO DO:
// (AG - ORD - mina'-) only on Numeric, (B6,..,BJ/BK -- ka-(DIR),san-,gé'-,hát-,tak-,ya- + REDUP) only on direction words
// Where does Location circumfixing fit in? (AU,AV) <-- currently put at end in cae we can use with directional prefixes
// Should gi- ('from' / LOCAL) be moved from directional words?
// FIX -- mana' = ma + na'  ... but these are in the wrong order at the moment
// ADD -- ga'- = animal classifier OR prefix of preference (likes to, loves to)
//
// WHAT TO DO ABOUT REPEATING AFFIXES? -- nina'binila (become bloated) on [[binila]] <-- or should 'binila' be treated as a singular lexical entry?
//
const affixation_combinations = [".",	//no affixation
"A0,A1,A2,A3,A4,A5,A6,A7,A8,A9,AA,AB,AC,AD,AE,AF,AG,AH,AI,AJ,AK,AL,AM,AN,AO,AP,AQ,AR,AS,AT,AU,AV,AW,AX,AY,AZ,B2,B3,B4,B5,B7,B8,B9,BA,BB,BC,BD,BH,BI",  //1 - Topping 1   (added BI -- not sure on each)
"A0,A1,A2,A3,A4,A5,A6,A7,A8,A9,AA,AB,AC,AD,AE,AF,AG,AH,AI,AJ,AK,AL,AM,AN,AO,AP,AQ,AR,AS,AT,AU,AV,AW,AX,AY,AZ,B2,B3,B4,B5,B7,B8,B9,BA,BB,BC,BD,BH,BL,BI",  //2 - Topping 2	("")
"A0,A1,A2,A3,A4,A5,A6,A7,A8,A9,AA,AB,AC,AD,AE,AF,AG,AH,AI,AJ,AK,AL,AM,AN,AO,AP,AQ,AR,AS,AT,AU,AV,AW,AX,AY,AZ,B2,B3,B4,B5,B7,B8,B9,BA,BB,BC,BD,BH,BI",  //3 - Topping 3	("")
"A0,A1,A2,A3,A4,A5,A6,A7,A8,A9,AA,AB,AC,AD,AE,AF,AG,AH,AI,AJ,AK,AL,AM,AN,AO,AP,AQ,AR,AS,AT,AU,AV,AW,AX,AY,AZ,B2,B3,B4,B5,B7,B8,B9,BA,BB,BC,BD,BH,BI",  //4 - Topping 4	("")
"BL",  //5 - (Vowel Fronting) (V.Har.) (BL) -- only at left edge -- internal Vowel Harmony is part of affixing rules (may need updates) -- from here to /00 (nothing else added)
"BL,A1,AC,B9",  //6 - (above) & Agreement (A1,AC,B9) <um>, man-, fan- -- last added -- from here only /05 can be added
"BL,A1,AC,B9,A0",  //7 - (above) & <in> Infixation (A0) -- from here, /06 are all possible
"BL,A1,AC,B9,A0,A2",  //8 - (above) & Reduplication (A2) -- from here, /07 are possible
"BL,A1,AC,B9,A0,A2,AJ,BA,AM,AN,AO,AP,AQ,AR,AS,AT",  //9 - (above) & Possessive Suffixes, -n, -ñaihon (AJ,BA,AM,AN,AO,AP,AQ,AR,AS,AT), from here only /08 (Vowel Fronting) can be added
"BL,A1,AC,B9,A0,A2,AJ,BA,AM,AN,AO,AP,AQ,AR,AS,AT,AH,AI,AK,AL,BB,BH",  //10 - (above) & Inner Suffixes (AH,AI,AK,AL,BB,BH) -i,-guan,-ña,-an/-guan,-on,-iyi, from here /09 are possible
"BL,A1,AC,B9,A0,A2,AJ,BA,AM,AN,AO,AP,AQ,AR,AS,AT,AH,AI,AK,AL,BB,BH,A4,A6,A9,AB,AF,AW,AX,AY,AZ,B5,B7,BC,BD",  //11 - (above) & Outer Prefixes (A4,A6,A9,AB,AF,AW,AX,AY,AZ,B5,B7,BC,BD) chá-,achá-,chat-,há-,na'-,pinat-,agón-,án-,é-,gai-,mana'-,mi-,tai-,tái-  -- from here /10 are possible -- or /11 -- can loop to self
"BL,A1,AC,B9,A0,A2,AJ,BA,AM,AN,AO,AP,AQ,AR,AS,AT,AH,AI,AK,AL,BB,BH,A4,A6,A9,AB,AF,AW,AX,AY,AZ,B5,B7,BC,BD,AD,B3,B4,A8",  //12 - (above) & Passive & Antipassive (AD,B3,B4,A8) ma-,fan-,man-,ná'-  -- from here, /11 are possible
"BL,A1,AC,B9,A0,A2,AJ,BA,AM,AN,AO,AP,AQ,AR,AS,AT,AH,AI,AK,AL,BB,BH,A4,A6,A9,AB,AF,AW,AX,AY,AZ,B5,B7,BC,BD,AD,B3,B4,A8,A3,A5,A7,AA,AE,B2",  //13 - (above) & Inner prefixes (A3,A5,A7,AA,AE,B2) á-,góf-,géf-,fa'-,ké-,lá-,ká-  -- from here, /12 are possible or /13 -- can loop self
"BL,A1,AC,B9,A0,A2,AJ,BA,AM,AN,AO,AP,AQ,AR,AS,AT,AH,AI,AK,AL,BB,BH,A4,A6,A9,AB,AF,AW,AX,AY,AZ,B5,B7,BC,BD,AD,B3,B4,A8,A3,A7,AA,AE,B2,B0,B1,B6,BE,BF,BG,BJ,BK" //14 - (above from 12) & Directional Prefixes (B0,B1,B6,BE,BF,BG,BJ,BK) (only on direction / location words): gé'-,hát-,ka-,ták-,talak-,gi-,san-,ya-  -- from here, /13 are possible
//15 - this is assigned to final reduplication (BI) (programmatically done in morph - not in hunspell) (originally in aff file as  SFX  BI  0  /14  .  INTENS  )
]


// *****AFFIX LISTING*****  (from our Hunspell .AFF definition file)

//  [A0] [PFX]    [  93]: -in-         <in>_INFIX               
//  [A1] [PFX]    [  30]: -um-         <um>_INFIX               
//  [A2] [PFX]    [ 235]: [various]    PROG                     Reduplication - Progressive (fix: Nominal with people... kanta --> kakanta "singer")
//  [A3] [PFX]    [   3]: á-           RECIP                    Reciprocal  
//  [A4] [PFX]    [   6]: chá-,achá-   SIM                      Similative, like X, equality of two things
//  [A5] [PFX]    [   2]: góf-,géf-    INTENS                   Intensifier, very, much, extremely
//  [A6] [PFX]    [   1]: chat-        'falsely/barely'         Barely, slightly; falsely
//  [A7] [PFX]    [   1]: fa'-         'change_into'            To change X (into Y), transform X
//  [A8] [PFX]    [   2]: ná'-         ANTIP.CAUS               Antipassive of a Causative
//  [A9] [PFX]    [   2]: há-          HAB                      Habitual
//  [AA] [PFX]    [   2]: ké-          PROSP                    Prospective, try to/about to do X
//  [AB] [PFX]    [   1]: na'-         CAUS                     Causative
//  [AC] [PFX]    [   7]: man-         PL                       Plural
//  [AD] [PFX]    [   2]: ma-          PASS                     Passive
//  [AE] [PFX]    [   2]: lá-          AUG                      Augmentative
//  [AF] [PFX]    [   1]: pinat-       'mostly'                 
//  [AG] [PFX]    [   1]: mina'-       ORD                      Ordinal
//  [AH] [SFX]    [  64]: -i,-yi       APPL                     Applicative (increasing number of grammatical arguments)
//  [AI] [SFX]    [   1]: -guan        'unknowingly/covertly'   Covertly, secretly, against someone's wishes, unintentionally
//  [AJ] [SFX]    [   8]: -ñaihon      'for_a_while'            Delimitative, for a little bit, immediately
//  [AK] [SFX]    [   1]: -ña          AUG                      Augmentative, more X (bigger, faster, etc.)
//  [AL] [SFX]    [   3]: -an,-guan    ATTR                     Attributive morpheme, has attributes of X, affected with X
//  [AM] [SFX]    [   5]: --hu         1S.POSS                  First Person singular Possessive Pronoun, "my"
//  [AN] [SFX]    [   5]: --ku         1S.POSS                  First Person singular Possessive Pronoun, "my"
//  [AO] [SFX]    [   5]: --mu         2S.POSS                  Second Person singular Possessive Pronoun, "your"
//  [AP] [SFX]    [   5]: --ña         3S.POSS                  Thrid Person singular Possessive Pronoun, "its, hers, his"
//  [AQ] [SFX]    [   5]: --ta         1PL.INCL.POSS            First Person plural inclusive Possessive Pronoun, "our (with you)"
//  [AR] [SFX]    [   5]: --måmi       1PL.EXCL.POSS            First Person plural Possessive Pronoun, "our (without you)"
//  [AS] [SFX]    [   5]: --miyu       2PL.POSS                 Second Person plural Possessive Pronoun, "y'all's"
//  [AT] [SFX]    [   5]: --ñiha       3PL.POSS                 Third Person plural Possessive Pronoun, "their"
//  [AU] [CFXPFX] [   9]: fan-       LOC  PREFIX PART OF CIRCUMFIX fan...an for places and times
//  [AV] [CFXSFX] [  21]: -an        LOC  SUFFIX PART OF CIRCUMFIX fan...an for places and times
//  [AW] [PFX]    [   1]: agón-        'repeat'                 like re- in English, to do again (not to do repeatedly)
//  [AX] [PFX]    [   1]: án-          'remaining'              Remaining or leftover bits and pieces (ánkanno' -- leftover foods, slops)
//  [AY] [PFX]    [   2]: é-           'search_for'             To search for X
//  [AZ] [PFX]    [   1]: gai-         POSS                     Possessive
//  [B0] [PFX]    [  77]: gé'-         AUG.LAT                  Augmentative Lative, more/further in a given direction (e.g. Gé'haya = more east)
//  [B1] [PFX]    [ 154]: hát-,lát-    AUG.LAT                  Augmentative Lative, more/further in a given direction (e.g. Háttichan = more west)
//  [B2] [PFX]    [   3]: ká-          '-ish'                   '-ish', '-y', 'kinds of'
//  [B3] [PFX]    [   7]: fan-         IRR.ANTIP                Irrealis antipassive                                              
//  [B4] [PFX]    [   7]: man-         ANTIP                    Antipassive
//  [B5] [PFX]    [   1]: mana'-       PASS.CAUS                Passive Voice Causative
//  [B6] [PFX]    [   2]: ka-          DIR                      Directional prefix
//  [B7] [PFX]    [   2]: mi-          'have_lots_of'           Have many of X
//  [B9] [PFX]    [   2]: fan-         IRR.AGR[PL]              Irrealis Plural Subject Agreement
//  [BA] [SFX]    [   3]: -n           LNK                      Linker (Topping, excrecent consonant)
//  [BB] [SFX]    [   2]: -on,-yon     ABIL                     Abilitative or Aptative, capable of being X
//  [BC] [PFX]    [   2]: tai-         SIM                      Similative, like X
//  [BD] [PFX]    [   2]: tái-         NEG.EXIST                Negative Existential -- there isn't
//  [BE] [PFX]    [  76]: ták-         AUG.LAT                  Aumentative Lative, (even) more / (even) farther in a given direction (causes fronting)
//  [BF] [PFX]    [  76]: talak-       face.DIR                 To face a given direction  (causes fronting)
//  [BG] [PFX]    [  76]: gi-          LCL                      Local case - of, at, from, regarding a place
//  [BH] [SFX]    [   4]: -iyi,-guiyi  BENEF                    Benefactive
//  [BI] [RDP]    [   1]: [various]    INTENS                   Final Reduplication - Intensifier *&*& (RDP is not approved category, but I'm using for morph analysis - see note)
//  [BJ] [PFX]    [   2]: ya-        SUP.LAT  PREFIX PART OF CIRCUMFIX yan...[REDUP] -- Superlative for places and times
//  [BK] [PFX]    [  76]: san-         DIR                      Directional prefix, in the direction of the root word (e.g., hulo' = up, sanhilo' = above)
//  [BL] [PFX]    [  78]: u->i,o->e    (Vowel Fronting)         Vowel Harmony, though phonological, necessary to account for to properly find words              