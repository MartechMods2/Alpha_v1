# Alpha Safe Media Mega Pack

This pack adds 106 public commands that work in activated groups and direct chats. It uses safe-search filters, preserves provider attribution, rejects private-network URLs, caps files at 25 MB and applies a 30-second per-member cooldown.

## Provider setup

No-key providers are Openverse, NASA Image Library and Internet Archive. Optional free keys unlock the larger catalogues:

```env
GIPHY_API_KEY=
PIXABAY_API_KEY=
FREESOUND_API_KEY=
```

The previously supported optional keys remain available:

```env
JAMENDO_CLIENT_ID=
PEXELS_API_KEY=
```

Use `$freeproviders` to see what is ready without revealing any secret.

## GIF and reaction commands

```text
$gifsearch celebration
$gifreact surprised
$gifhappy
$gifsad
$gifangry
$giflaugh
$gifdance
$giflove
$gifwow
$gifclap
$gifparty
$gifconfused
$giffacepalm
$gifgoodmorning
$gifgoodnight
$gifbirthday
$gifcongrats
$gifthankyou
$gifwelcome
$gifbye
$gifyes
$gifno
$gifhug
$gifcry
$gifcheer
$randomgif
$trendinggif
```

These use GIPHY's safe `g` rating and include “Powered by GIPHY” attribution.

## Free photo commands

Every command accepts optional extra search words.

```text
$stockphoto office team
$freeimage classroom
$wallpaperhd green nature
$naturephoto waterfall
$cityphoto Lagos
$foodphoto jollof rice
$africanphoto family
$nigeriaimage culture
$schoolphoto pupils
$techphoto laptop
$businessphoto meeting
$travelphoto beach
$animalphoto lion
$flowerphoto roses
$carphoto sports car
$fashionphoto African clothing
$sportphoto football
$musicphoto headphones
$spacephoto stars
$abstractphoto green
$backgroundphoto books
$profilephoto student
$posterphoto education
$kidphoto learning
$educationphoto mathematics
$bookphoto library
```

Pixabay is tried first when configured, followed by Openverse.

## Free video commands

```text
$stockclip office
$freevideo forest
$natureclip waterfall
$cityclip Lagos
$foodclip cooking
$africaclip culture
$schoolclip classroom
$techclip computer
$businessclip teamwork
$travelclip beach
$animalclip wildlife
$oceanclip waves
$rainclip window
$fireclip campfire
$celebrationclip birthday
$danceclip Afrobeats
$sportclip football
$timelapseclip clouds
$aerialclip city
$backgroundclip abstract
```

Pixabay is tried first when configured; Internet Archive provides the no-key licensed fallback.

## Sound-effect commands

```text
$soundsearch door opening
$soundeffect swoosh
$applausefx
$laughfx
$rainfx
$thunderfx
$oceanfx
$naturefx
$cityfx
$crowdsfx
$bellfx school
$drumfx
$wooshfx
$clickfx
$alarmfx
$birdfx
$dogfx
$catfx
$footstepsfx
$ambiencefx classroom
```

Freesound is tried first when configured, followed by openly licensed Openverse audio.

## NASA image commands

```text
$nasaimage solar system
$spacepic
$earthpic
$moonpic
$marspic
$galaxypic
$nebulapic
$astronautpic
$rocketpic
$satellitepic
```

NASA Image Library access does not require a key.

## Help and status

```text
$safemediahelp
$mediacategories
$freeproviders
```

These commands do not use YouTube, browser cookies, public proxies, status automation, bulk messaging or unsolicited private messages.
