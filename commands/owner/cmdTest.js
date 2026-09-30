import calcCommand from "../public/calc.js";

const handler = async (sock, msg, from, args, info) => {
  // Owner commands are also available to configured moderators. Never execute
  // arbitrary JavaScript with the bot's credentials or database connection.
  if (!args.length) return info.sendMessageWTyping(from, { text: `Use ${info.prefix}test 25 * 4 + 10 to test arithmetic. Use Dashboard → Command Lab to test command syntax and offline handlers.` }, { quoted: msg });
  return calcCommand().handler(sock, msg, from, args, info);
};
export default () => ({ cmd: ["test", "code"], desc: "Safely test arithmetic; use the dashboard Command Lab for commands", usage: "test <expression> | code <expression>", handler });
