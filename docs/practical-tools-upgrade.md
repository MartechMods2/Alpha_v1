# Alpha Practical Tools and dashboard upgrade

115 new offline utilities, with working handlers and examples in the dashboard Command Guide. They also execute in Command Lab. Use `$toolshelp` to see categories or `$toolshelp text` for text examples. Replace `$` with your configured prefix. For line-based tools, enter real new lines.

## Text (25)

| Command | Purpose | Example |
|---|---|---|
| trimtext | Remove surrounding whitespace | `$trimtext   Hello Alpha  ` |
| compacttext | Collapse repeated whitespace | `$compacttext Hello   Alpha` |
| paragraphcount | Count nonempty paragraphs | `$paragraphcount Hello ↵  ↵ Welcome` |
| sentencecount | Count sentence-ending punctuation groups | `$sentencecount Hello. Welcome!` |
| longestword | Find the longest word | `$longestword Build useful communities` |
| shortestword | Find the shortest word | `$shortestword Build a community` |
| wordfrequency | Show ten most frequent words | `$wordfrequency hello hello alpha` |
| uniquevocabs | List distinct words alphabetically | `$uniquevocabs Hello hello Alpha` |
| averagewordlength | Calculate mean word length | `$averagewordlength Hello Alpha` |
| textbytes | Count UTF-8 bytes | `$textbytes Hello Alpha` |
| reverselines | Reverse line order | `$reverselines One ↵ Two` |
| sortlength | Sort lines from shortest to longest | `$sortlength Community ↵ Alpha` |
| bullettext | Turn lines into bullet points | `$bullettext Plan ↵ Build ↵ Test` |
| checklisttext | Turn lines into a checklist | `$checklisttext Plan ↵ Build` |
| quoteeach | Quote each line | `$quoteeach Alpha ↵ Martech` |
| unaccent | Remove combining accents | `$unaccent café déjà vu` |
| swapcase | Swap letter case | `$swapcase Hello Alpha` |
| pascalcase | Make a PascalCase identifier | `$pascalcase Hello Alpha` |
| initials | Extract name initials | `$initials Martech Alpha Team` |
| acronymexpand | Format phrase with its acronym | `$acronymexpand National Information Technology` |
| dedupewords | Remove repeated words preserving order | `$dedupewords hello alpha hello` |
| palindromecheck | Check a normalized palindrome | `$palindromecheck Never odd or even` |
| findreplace | Replace literal text: text \| search \| replacement | `$findreplace Hello Alpha \| Alpha \| Team` |
| textslice | Extract characters: text \| start \| end | `$textslice Hello Alpha \| 0 \| 5` |
| textrepeat | Repeat text up to 20 times: count \| text | `$textrepeat 3 \| Go Alpha` |

## Numbers (24)

| Command | Purpose | Example |
|---|---|---|
| numsum | Sum a number list | `$numsum 10 20 30` |
| numproduct | Multiply a number list | `$numproduct 2 3 4` |
| nummean | Calculate arithmetic mean | `$nummean 10 20 30` |
| nummedian | Calculate median | `$nummedian 9 2 4` |
| nummode | Find all most frequent numbers | `$nummode 2 2 3 3 4` |
| numrange | Calculate max minus min | `$numrange 3 8 12` |
| nummin | Find minimum | `$nummin 3 8 12` |
| nummax | Find maximum | `$nummax 3 8 12` |
| numsort | Sort numbers ascending | `$numsort 9 2 4` |
| numvariance | Population variance | `$numvariance 2 4 6` |
| numstddev | Population standard deviation | `$numstddev 2 4 6` |
| numrms | Root mean square | `$numrms 3 4` |
| numgcd | Greatest common divisor | `$numgcd 24 36` |
| numlcm | Least common multiple | `$numlcm 12 18` |
| primecheck | Check integer primality up to 1 billion | `$primecheck 97` |
| factorlist | List positive integer factors up to 1 billion | `$factorlist 36` |
| factorialcalc | Factorial of 0–100 | `$factorialcalc 5` |
| fibonaccilist | First 1–50 Fibonacci numbers | `$fibonaccilist 8` |
| fractionreduce | Reduce numerator denominator | `$fractionreduce 24 36` |
| ratiosimplify | Simplify an integer ratio | `$ratiosimplify 18 24` |
| percentof | Calculate percent of value: percent value | `$percentof 15 200` |
| whatpercent | Find part as percentage of whole | `$whatpercent 25 200` |
| rounddigits | Round value to 0–10 decimal places | `$rounddigits 3.14159 2` |
| weightedmean | Weighted mean: values \| weights | `$weightedmean 10 20 \| 1 3` |

## Geometry (21)

| Command | Purpose | Example |
|---|---|---|
| squarearea | Square area: side | `$squarearea 5` |
| squareperimeter | Square perimeter: side | `$squareperimeter 5` |
| rectanglearea | Rectangle area: length width | `$rectanglearea 8 5` |
| rectangleperimeter | Rectangle perimeter: length width | `$rectangleperimeter 8 5` |
| trianglearea | Triangle area: base height | `$trianglearea 8 5` |
| circlearea | Circle area: radius | `$circlearea 7` |
| circlecircumference | Circle circumference: radius | `$circlecircumference 7` |
| cubediagonal | Cube space diagonal: side | `$cubediagonal 4` |
| cubevolume | Cube volume: side | `$cubevolume 4` |
| cubesurface | Cube surface area: side | `$cubesurface 4` |
| cuboidvolume | Cuboid volume: length width height | `$cuboidvolume 4 5 6` |
| cylindervolume | Cylinder volume: radius height | `$cylindervolume 3 8` |
| cylindersurface | Cylinder total surface: radius height | `$cylindersurface 3 8` |
| conevolume | Cone volume: radius height | `$conevolume 3 8` |
| spherevolume | Sphere volume: radius | `$spherevolume 3` |
| spheresurface | Sphere surface area: radius | `$spheresurface 3` |
| hypotenuse | Right triangle hypotenuse: two legs | `$hypotenuse 3 4` |
| distance2d | Distance: x1 y1 x2 y2 | `$distance2d 0 0 3 4` |
| midpoint2d | Midpoint: x1 y1 x2 y2 | `$midpoint2d 0 0 4 6` |
| slope2d | Slope: x1 y1 x2 y2 | `$slope2d 0 0 4 6` |
| cuboidsurface | Cuboid surface area: length width height | `$cuboidsurface 4 5 6` |

## Money arithmetic (15)

| Command | Purpose | Example |
|---|---|---|
| discountprice | Price after discount: price percent | `$discountprice 10000 15` |
| discountsaved | Discount amount: price percent | `$discountsaved 10000 15` |
| markupprice | Selling price: cost markup percent | `$markupprice 5000 20` |
| profitamount | Profit: revenue cost | `$profitamount 12000 9000` |
| profitmargin | Profit margin percent: revenue cost | `$profitmargin 12000 9000` |
| markuppercent | Markup percent: selling cost | `$markuppercent 12000 9000` |
| taxadd | Add user-supplied tax: price percent | `$taxadd 10000 7.5` |
| taxextract | Extract user-supplied tax: inclusive price percent | `$taxextract 10750 7.5` |
| simpleinterest | Interest: principal annual-percent years | `$simpleinterest 100000 5 2` |
| compoundbalance | Annual compounding: principal percent years | `$compoundbalance 100000 5 2` |
| savingsmonths | Months to save: target current monthly | `$savingsmonths 100000 20000 10000` |
| unitprice | Cost per item: total quantity | `$unitprice 12000 24` |
| breakevenunits | Break-even units: fixed-cost price variable-cost | `$breakevenunits 100000 2000 1000` |
| budgetremaining | Budget remaining: budget expense-list | `$budgetremaining 50000 10000 15000` |
| contributionperperson | Equal contribution: target people | `$contributionperperson 100000 20` |

## Planning (10)

| Command | Purpose | Example |
|---|---|---|
| weekdayof | Weekday for a calendar date | `$weekdayof 2026-10-02` |
| isleapyear | Check Gregorian leap year | `$isleapyear 2028` |
| adddays | Add calendar days: date count | `$adddays 2026-10-02 10` |
| monthlength | Days in month: year month | `$monthlength 2026 2` |
| dayofyear | Day number within a year | `$dayofyear 2026-10-02` |
| quarterof | Calendar quarter | `$quarterof 2026-10-02` |
| weekendcheck | Check Saturday or Sunday | `$weekendcheck 2026-10-03` |
| durationformat | Format seconds as days/hours/minutes/seconds | `$durationformat 90061` |
| studyallocation | Equal study time: minutes subjects | `$studyallocation 120 4` |
| decisionmatrix | Rank options by weighted criteria: labels \| weights \| score rows | `$decisionmatrix Phone A,Phone B \| 2 1 \| 8 5; 6 9` |

## Developer (20)

| Command | Purpose | Example |
|---|---|---|
| jsonpretty | Format valid JSON | `$jsonpretty {"alpha":true}` |
| jsoncompact | Minify valid JSON | `$jsoncompact { "alpha": true }` |
| jsonkeys | List top-level object keys | `$jsonkeys {"alpha":true,"mode":"fast"}` |
| jsonvalues | List top-level object values | `$jsonvalues {"alpha":true,"count":3}` |
| jsonvalidate | Validate JSON syntax | `$jsonvalidate {"alpha":true}` |
| jsonarraylength | Count JSON array items | `$jsonarraylength [1,2,3]` |
| htmlescape | Escape HTML text | `$htmlescape <Alpha & Martech>` |
| htmlunescape | Decode common HTML entities | `$htmlunescape &lt;Alpha&gt;` |
| striphtmltext | Strip markup for plain text; not a security sanitizer | `$striphtmltext <b>Hello</b> Alpha` |
| urlparts | Inspect URL components without fetching it | `$urlparts https://example.com/path?q=alpha` |
| urlquery | List URL query parameters without fetching | `$urlquery https://example.com/?q=alpha&page=2` |
| urlclean | Remove common tracking parameters without fetching | `$urlclean https://example.com/?utm_source=chat&q=alpha` |
| sha512text | Hash text with SHA-512 | `$sha512text Hello Alpha` |
| sha384text | Hash text with SHA-384 | `$sha384text Hello Alpha` |
| hexencode | Encode UTF-8 text as hex | `$hexencode Hello Alpha` |
| hexdecode | Decode valid UTF-8 hex bytes | `$hexdecode 48656c6c6f` |
| unicodepoints | Inspect Unicode code points | `$unicodepoints Alpha ⚡` |
| utf8bytes | Show UTF-8 hexadecimal byte sequence | `$utf8bytes Alpha` |
| listtojson | Convert nonempty lines to JSON array | `$listtojson Alpha ↵ Martech` |
| jsontolist | Convert a JSON scalar array to lines | `$jsontolist ["Alpha","Martech"]` |

## Reliability and speed

Inputs are bounded to 4000 characters; numerical lists are bounded to 100 values. Heavy integer operations have explicit limits. No JavaScript expressions are evaluated and no network requests are made by these tools. Monetary calculations use supplied rates; the pack does not look up legal tax rates or give investment recommendations. Geometry results use your input units, squared or cubed as appropriate. Numeric calculations use JavaScript floating-point arithmetic.

Dashboard pages load on demand. The entry JavaScript fell from 531.36 kB to roughly 203.74 kB; route and chart chunks load separately when required. This is an asset-size measurement, not a claim about production network latency. Concurrent identical dashboard GETs share a request; completed data is not cached. Concurrent metadata fetches for the same group share one WhatsApp request. Sidebar polling skips hidden tabs.

Custom dropdowns support arrow keys, Home/End, Enter, Escape, typeahead and disabled options. They use a portal so menus are not clipped by cards. Login, sidebar, customization preview and favicon now use the refreshed Alpha mark; existing custom avatars are preserved. Shared styles cover inputs and placeholders on old and new pages.

Run `npm run verify` before deploying. After Render deploys the commit, reload the dashboard to fetch the new assets, then confirm a sample tool in WhatsApp.
