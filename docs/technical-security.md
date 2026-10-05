# Alpha technical security toolkit

Ten additions complement the existing `$osinthelp`, `$sechelp` and `$kalihelp` packs. Use public or redacted material; do not paste passwords, private keys or confidential production configuration into a group.

| Command | Purpose | Example |
|---|---|---|
| `$techsechelp` | List the toolkit and examples | `$techsechelp` |
| `$dkimlookup` | Public TXT lookup for a known DKIM selector; no selector guessing | `$dkimlookup example.com selector1` |
| `$spfreview` | Review supplied SPF policy, permissive all terms and direct lookup terms | `$spfreview v=spf1 include:_spf.example.com ~all` |
| `$dmarcreview` | Review supplied DMARC policy, percentage and alignment flags | `$dmarcreview v=DMARC1; p=none; pct=100` |
| `$mailheaderreview` | Summarize supplied From, Received count and SPF/DKIM/DMARC results | Paste email headers after `$mailheaderreview` |
| `$sshaudit` | Review global directives in a supplied sshd_config excerpt | Paste config after `$sshaudit` |
| `$dockeraudit` | Flag privileged mode, Docker socket mounting, host namespaces, broad capabilities and selected Dockerfile patterns | Paste Dockerfile or Compose text after `$dockeraudit` |
| `$gitignoreaudit` | Review common environment/key ignore rules and negations | Paste ignore rules after `$gitignoreaudit` |
| `$pemaudit` | Inspect a public PEM certificate locally | Paste a BEGIN CERTIFICATE block after `$pemaudit` |
| `$ioccompare` | Compare two literal, case-sensitive indicator lists | `$ioccompare example.com` then a new line with `1.1.1.1 | example.com` |
| `$pentestscope` | Produce an authorization/scope template for an assessment | `$pentestscope example.com \| staging.example.com` |

For multiline input, send a single message:

```
$sshaudit
PermitRootLogin yes
PasswordAuthentication yes
PermitEmptyPasswords no
```

The SSH check does not resolve Include files or Match blocks. Docker and Git checks are heuristic pattern checks, not complete parsers. Authentication-Results can be forged unless it comes from your trusted receiving mail system. PEM inspection does not validate a trust chain, revocation or hostname. SPF reviews do not recursively expand DNS includes. An assessment template does not grant permission.

DKIM queries are quota limited and time bounded to eight seconds. Other additions operate locally with a 6000-character limit. The owner can disable the toolkit with SECURITY_TOOLS_ENABLED=false. The nine local tools execute in the dashboard Command Lab; DKIM lookup runs through WhatsApp. All additions have examples in the dashboard Command Guide. Existing security lab commands now preserve pasted multiline input.
