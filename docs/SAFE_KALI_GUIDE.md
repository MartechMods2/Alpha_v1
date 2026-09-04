# Alpha by Martech — Safe Kali-Inspired Tools

These tools support security education and defensive review. Alpha does not execute Kali commands, scan targets, create phishing login pages, capture credentials or locate individuals.

## Main menu

```text
$safekalihelp
```

## Phishing defence

```text
$phishcheck <message or URL>
$phishscore <message or URL>
$phishemailcheck <email text>
$phishsmscheck <SMS text>
$lookalikecheck official.com | suspicious.com
$unicodehostcheck <URL>
$safelinkpreview <URL>
$linkextract <message containing links>
$phishlesson
$phishquiz
$phishreport
$phishtraining
$reportphish
```

`$phishtraining` produces a clearly labelled awareness scenario and never creates a login form or collects information.

## Public-IP and phone safety

```text
$ipregion 1.1.1.1
$phonemeta +2348085109399
$phonecountry +2348085109399
$phonetype +2348085109399
$phonee164 08085109399
$phoneprivacy
$phoneconsent
$phonesafety
```

`$ipregion` returns public registry country/network ownership only—not a home address, GPS position or a person's exact location. Phone tools format consented numbers and show numbering metadata only; they do not enumerate accounts or identify the owner.

## Authorisation and reporting

```text
$legalcheck
$scopetemplate
$roetemplate
$evidencechecklist
$incidentplan
$breachresponse
$disclosureguide
$riskrating
$remediationplan
$labguide
```

## Defensive system guidance

```text
$kaliguide
$kaliinstallguide
$linuxperms
$chmodexplain
$hashguide
$tlsversions
$cipherguide
$firewallguide
$sshhardening
$webhardening
$apihardening
$databasehardening
$dockerhardening
$kubernetesguide
$logguide
```

## Tool education—not execution

```text
$yaraexplain
$sigmaexplain
$wiresharkguide
$nmapguide
$burpguide
$zapguide
$metasploitguide
```

These explain safe purpose, authorisation and limitations. They do not generate exploit commands or execute tools on the Render server.
