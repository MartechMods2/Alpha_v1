const sections = [
	["Safety", "antiraid · slowmode · lockdown · grouphours · warnexpiry · appeal · wordfilter · mentionlimit · medialimit · probation"],
	["Automation", "schedulepost · schedulepoll · remindplus · eventrepeat · taskassign · dutyrotate · attendancesession · form · slots"],
	["Documents", "ocr · qr · readqr · img2pdf · pdf2img · pdfmerge · pdfsplit · pdfcompress · fileinfo · filescan"],
	["Media and AI", "album · cleanmedia · transcribe · voicesummary · voicetranslate · autocaption · aiproviders · webfactcheck"],
	["Games", "ttt · connect4 · tournament · familyfeud · quizbank · season · gamenight"],
	["Virtual economy", "wallet · dailycoins · shop · buy · inventory · giftcoins · richlist"],
	["Privacy", "privacydata status · privacydata export · privacydata delete confirm"],
	["Passive OSINT", "osinthelp · dns · rdap · iprdap · asn · ptr · tls · headers · emailsecurity · ctsearch · hashid"],
	["Defensive Security Lab", "sechelp · securlrisk · seciocdetect · secpasswordstrength · secheaderreport · seclogsummary · secpiiredact"],
];

const handler = async (_sock, msg, from, _args, { sendMessageWTyping }) => sendMessageWTyping(from, {
	text: `🛡️ *Safe Complete Feature Pack*\n\n${sections.map(([title, commands]) => `*${title}*\n${commands}`).join("\n\n")}\n\nUse the normal \`menu\` command for the complete command directory. Administrators can view runtime health in Dashboard → Safe Pack.`,
}, { quoted: msg });

export default () => ({ cmd: ["safepackhelp"], desc: "Show the account-safe feature pack command guide", usage: "safepackhelp", handler });
