import { fileTypeFromBuffer } from "file-type";
import { downloadOpenMedia } from "../../utils/openMediaSources.js";
import { findSafeImage, findSafeSound, findSafeVideo, providerStatus, searchGiphy, searchNasaImage } from "../../utils/safeMediaProviders.js";

const GIF_PRESETS = {
	gifsearch:"reaction",gifreact:"reaction",gifhappy:"happy",gifsad:"sad",gifangry:"angry",giflaugh:"laughing",gifdance:"dancing",giflove:"love",gifwow:"wow reaction",gifclap:"applause",gifparty:"party",gifconfused:"confused",giffacepalm:"facepalm",gifgoodmorning:"good morning",gifgoodnight:"good night",gifbirthday:"happy birthday",gifcongrats:"congratulations",gifthankyou:"thank you",gifwelcome:"welcome",gifbye:"goodbye",gifyes:"yes",gifno:"no",gifhug:"hug",gifcry:"crying",gifcheer:"cheering",randomgif:"funny reaction",trendinggif:"trending",
};
const IMAGE_PRESETS = {
	stockphoto:"stock photo",freeimage:"creative commons",wallpaperhd:"wallpaper",naturephoto:"nature",cityphoto:"city",foodphoto:"food",africanphoto:"Africa",nigeriaimage:"Nigeria",schoolphoto:"school",techphoto:"technology",businessphoto:"business",travelphoto:"travel",animalphoto:"animals",flowerphoto:"flowers",carphoto:"cars",fashionphoto:"fashion",sportphoto:"sports",musicphoto:"music",spacephoto:"outer space",abstractphoto:"abstract",backgroundphoto:"background",profilephoto:"portrait",posterphoto:"poster background",kidphoto:"children",educationphoto:"education",bookphoto:"books",
};
const VIDEO_PRESETS = {
	stockclip:"stock footage",freevideo:"creative commons video",natureclip:"nature",cityclip:"city",foodclip:"food",africaclip:"Africa",schoolclip:"school",techclip:"technology",businessclip:"business",travelclip:"travel",animalclip:"animals",oceanclip:"ocean",rainclip:"rain",fireclip:"fire",celebrationclip:"celebration",danceclip:"dancing",sportclip:"sports",timelapseclip:"timelapse",aerialclip:"aerial",backgroundclip:"video background",
};
const SOUND_PRESETS = {
	soundsearch:"sound effect",soundeffect:"sound effect",applausefx:"applause",laughfx:"laughter",rainfx:"rain",thunderfx:"thunder",oceanfx:"ocean waves",naturefx:"nature ambience",cityfx:"city ambience",crowdsfx:"crowd",bellfx:"bell",drumfx:"African drum",wooshfx:"whoosh",clickfx:"click",alarmfx:"alarm",birdfx:"birds",dogfx:"dog",catfx:"cat",footstepsfx:"footsteps",ambiencefx:"ambient sound",
};
const NASA_PRESETS = { nasaimage:"space",spacepic:"space",earthpic:"planet Earth",moonpic:"Moon",marspic:"Mars",galaxypic:"galaxy",nebulapic:"nebula",astronautpic:"astronaut",rocketpic:"rocket launch",satellitepic:"satellite" };

export const SAFE_MEDIA_COMMANDS = [...Object.keys(GIF_PRESETS),...Object.keys(IMAGE_PRESETS),...Object.keys(VIDEO_PRESETS),...Object.keys(SOUND_PRESETS),...Object.keys(NASA_PRESETS),"safemediahelp","mediacategories","freeproviders"];
const cooldowns = new Map();
const safe = (v,m=120)=>String(v||"").replace(/[\r\n\t*_~`]/g," ").replace(/\s+/g," ").trim().slice(0,m);
const reply=(send,from,msg,text)=>send(from,{text},{quoted:msg});
const queryFor=(preset,args)=>safe([preset,args.join(" ")].filter(Boolean).join(" "),150);
const claim=(jid)=>{const now=Date.now(),left=(cooldowns.get(jid)||0)-now;if(left>0)throw new Error(`Wait ${Math.ceil(left/1000)} seconds before another media request.`);cooldowns.set(jid,now+30_000);};

const sendMedia=async(result,send,from,msg)=>{
	if(!result)throw new Error("No safe media result was found. Try different search words.");
	const buffer=await downloadOpenMedia(result);
	const type=await fileTypeFromBuffer(buffer).catch(()=>null);const mime=type?.mime||result.mime||"application/octet-stream";
	const caption=`✨ *${safe(result.title)}*${result.artist?`\n👤 ${safe(result.artist)}`:""}\n📚 ${safe(result.source)}\n🪪 ${safe(result.license,140)}`;
	if(result.gifPlayback)return send(from,{video:buffer,mimetype:"video/mp4",gifPlayback:true,caption:`Powered by GIPHY\n${caption}`},{quoted:msg});
	if(mime.startsWith("image/"))return send(from,{image:buffer,mimetype:mime,caption},{quoted:msg});
	if(mime.startsWith("video/"))return send(from,{video:buffer,mimetype:mime,caption},{quoted:msg});
	if(mime.startsWith("audio/")){await reply(send,from,msg,caption);return send(from,{audio:buffer,mimetype:mime,ptt:false},{quoted:msg});}
	return send(from,{document:buffer,mimetype:mime,fileName:`${safe(result.title,80)}.${type?.ext||result.ext||"bin"}`,caption},{quoted:msg});
};

const help=(p)=>`🎬 *Alpha Safe Media Mega Pack*\n\n${p}giflaugh [extra words]\n${p}naturephoto [extra words]\n${p}danceclip [extra words]\n${p}applausefx [extra words]\n${p}marspic [extra words]\n${p}mediacategories\n${p}freeproviders\n\n*106 safe media features* work in groups and DMs. Results are safe-search filtered, attribution is retained, files are capped at 25 MB and requests have a 30-second cooldown.`;

const handler=async(_sock,msg,from,args,info)=>{
	const {command,prefix,senderJid,sendMessageWTyping:send}=info;
	if(command==="safemediahelp")return reply(send,from,msg,help(prefix));
	if(command==="mediacategories")return reply(send,from,msg,`🗂️ *Media Categories*\n\n🎞️ GIF/reactions: 27\n🖼️ Photos/backgrounds: 26\n🎥 Videos/clips: 20\n🔊 Sounds/effects: 20\n🚀 NASA space images: 10\n🧰 Help/provider tools: 3\n\nUse ${prefix}safemediahelp for examples.`);
	if(command==="freeproviders"){const s=providerStatus();return reply(send,from,msg,`📡 *Free Provider Health*\n\n${s.giphy?"✅":"⚪"} GIPHY — ${s.giphy?"configured":"GIPHY_API_KEY optional"}\n${s.pixabay?"✅":"⚪"} Pixabay — ${s.pixabay?"configured":"PIXABAY_API_KEY optional"}\n${s.freesound?"✅":"⚪"} Freesound — ${s.freesound?"configured":"FREESOUND_API_KEY optional"}\n✅ Openverse — no key\n✅ NASA — no key\n✅ Internet Archive — no key`);}
	try{
		claim(senderJid);
		let media;
		if(command in GIF_PRESETS)media=await searchGiphy(queryFor(GIF_PRESETS[command],args),{trending:command==="trendinggif"});
		else if(command in IMAGE_PRESETS)media=await findSafeImage(queryFor(IMAGE_PRESETS[command],args));
		else if(command in VIDEO_PRESETS)media=await findSafeVideo(queryFor(VIDEO_PRESETS[command],args));
		else if(command in SOUND_PRESETS)media=await findSafeSound(queryFor(SOUND_PRESETS[command],args));
		else media=await searchNasaImage(queryFor(NASA_PRESETS[command],args));
		return await sendMedia(media,send,from,msg);
	}catch(error){cooldowns.delete(senderJid);return reply(send,from,msg,`❌ ${safe(error.message,300)}`);}
};

export default()=>({cmd:SAFE_MEDIA_COMMANDS,desc:"106 free, safe media searches for GIFs, photos, videos, sounds and NASA images",usage:"safemediahelp",handler});
