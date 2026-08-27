const getDate = () => {
	const date = new Date().toLocaleString("en-US", {
		timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos",
	});
	return new Date(date);
};

export default getDate;
