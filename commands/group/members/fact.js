import axios from "axios";

const handler = async (sock, msg, from, args, msgInfoObj) => {
    const { sendMessageWTyping } = msgInfoObj;
    const factURL = "https://nekos.life/api/v2/fact";
    try {
        await axios(factURL).then((res) => {
            sendMessageWTyping(from, {
                text: `💡 *Random Fact*\n\n${res.data.fact}`
            }, { quoted: msg });
        });
    } catch (err) {
        sendMessageWTyping(from, { text: err.toString() }, { quoted: msg });
        console.log(err);
    }
}


export default () => ({
    cmd: ["fact"],
    desc: "Get random fact",
    usage: "fact",
    handler
});

