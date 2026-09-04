# Human Alpha, Owner Intents and Birthday Guide

## Owner-only natural commands

Set the verified owner number using digits only:

```env
MY_NUMBER=2348140893169
MARTECH_OWNER_NUMBER=2348140893169
```

Only this verified WhatsApp identity can run natural moderator actions. Supported exact requests:

- `mention all members` → `tagall`
- `I want you to mention all the members` → `tagall`
- `show group admins` → `admin`
- `show muted members` → `mutelist`
- `show birthday list` → `birthday list`
- `enable birthday greetings` → `birthdayauto on`
- `show group statistics` → `groupstats`
- `show security tools` → `safekalihelp`

Ambiguous, destructive and high-risk requests still require an explicit command. `tagall` has a 30-minute natural-language cooldown. Other people cannot use this privileged route.

## Birthday form and automatic greeting

```text
$birthdayform
$birthday set 24-12
$birthday
$birthday remove
$birthdayauto on
```

Members save only day and month. An administrator enables automation once with `$birthdayauto on`. Alpha sends one combined greeting when several people share the day.

## Member-selected tone and pronouns

Alpha defaults to gender-neutral language and never guesses gender from a name, picture, number or writing style.

```text
$mystyle
$mytone friendly
$mytone funny
$mytone professional
$mytone gentle
$mytone concise
$mytone auto
$mypronouns neutral
$mypronouns he
$mypronouns she
$mypronouns they
$resetstyle
```

## Three extra usability upgrades

```text
$onboardme
$featurefinder download a Nigerian song
$privacycoach
```

`featurefinder` previews the best matching command without executing it.

## Safe evolution

```text
$upgradecheck
$updatestatus
```

The owner-only checker compares the deployed commit with approved `main`. It never downloads, modifies or executes code. Keep Render auto-deploy limited to reviewed main-branch changes whose CI and CodeQL checks pass.
