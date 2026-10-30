export default () => ({
  cmd:["extension"],desc:"Open the dashboard to pair or manage Alpha extensions",usage:"extension",
  handler:(_sock,_msg,from,_args,info)=>info.sendMessageWTyping(from,{text:"🔌 Extension pairing and management are available only through the dashboard. Ask the creator for a private, one-use dashboard pairing link. Chat cannot create sessions or display pairing codes."}),
});
