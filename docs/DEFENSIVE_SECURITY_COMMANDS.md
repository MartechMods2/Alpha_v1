# Alpha by Martech — 110 Defensive Security Commands

These commands are free and analyse only supplied text. They do not scan targets, exploit systems, crack passwords, track people or run shell/Kali commands.

```text
$sechelp
$sechelp url
$sechelp ioc
$sechelp auth
$sechelp headers
$sechelp logs
```

## URL safety — 25

`securlparse`, `securlnormalize`, `securlscheme`, `securlhost`, `securlport`, `securlpath`, `securlquery`, `securlfragment`, `securlorigin`, `securlusercheck`, `securlhttps`, `securlshortener`, `securlredirecthint`, `securlencoded`, `securliphost`, `securlpunycode`, `securlsuspicious`, `securlrisk`, `securlparams`, `securltracking`, `securlstriptracking`, `securlfilename`, `securlextension`, `secdefang`, `secrefang`.

Example: `$securlrisk http://bit.ly/example`

## Indicators and identifiers — 20

`secipcheck`, `secipv4`, `secipv6`, `seccidrcheck`, `secprivateip`, `secloopback`, `secemailcheck`, `secemaildomain`, `sechashidentify`, `seciocdetect`, `secioccount`, `secdomaincheck`, `secsubdomaincount`, `secportname`, `secmaccheck`, `secuuidcheck`, `seccvecheck`, `seccwecheck`, `seccvsslevel`, `secmitreid`.

Example: `$seciocdetect suspicious.example 1.1.1.1 user@example.com`

## Authentication, tokens and encoding — 20

`secpasswordstrength`, `secpassphrase`, `secentropy`, `secjwtdecode`, `secjwtheader`, `secjwtclaims`, `secjwtexpiry`, `secbase64check`, `secbase64decode`, `sechexcheck`, `sechexdecode`, `securlencode`, `securldecode`, `sechmacguide`, `sechashequality`, `secconstanttime`, `sectotpcheck`, `secapikeymask`, `secsecretmask`, `seccredentialscan`.

Example: `$secjwtclaims eyJ...token`. Never paste live passwords, tokens or private keys into a group.

## HTTP security headers — 20

`seccspcheck`, `sechstscheck`, `secframecheck`, `secnosniffcheck`, `secreferrercheck`, `secpermissionscheck`, `seccorscheck`, `seccookiecheck`, `secsecurecookie`, `sechttponly`, `secsamesite`, `seccachecheck`, `secserverleak`, `secpoweredbyleak`, `seccontenttype`, `secmixedcontent`, `seccspnonce`, `seccspunsafe`, `secsecurityscore`, `secheaderreport`.

Paste response headers as `Name: value` lines. Example: `$secsecurityscore content-security-policy: default-src 'self'`.

## Log safety and redaction — 25

`seclogsummary`, `seclogips`, `seclogstatus`, `seclogerrors`, `seclogauthfail`, `secloguseragents`, `seclogpaths`, `seclogmethods`, `seclogtimestamps`, `seclogredact`, `secpiiredact`, `secemailredact`, `secphoneredact`, `secipredact`, `sectokenredact`, `secsecretfind`, `secsqlisignal`, `secxsssignal`, `secpathtraversal`, `seccmdinjection`, `seclog4jsignal`, `secbasicauthcheck`, `secbearercheck`, `secnewlinecheck`, `secunicodecheck`.

Example: `$seclogsummary 1.1.1.1 GET /login 401`.

Pattern matches are review signals, not proof of an attack. Work only on systems you own or are authorised to assess.
