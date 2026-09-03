import { parsePhoneNumber } from "awesome-phonenumber";

const DEFAULT_COUNTRY = "NG";
const ISO_COUNTRY = /^[A-Z]{2}$/;

const cleanCountry = (value) => {
	const country = String(value || DEFAULT_COUNTRY).trim().toUpperCase();
	return ISO_COUNTRY.test(country) ? country : DEFAULT_COUNTRY;
};

const candidateResult = (candidate, regionCode) => {
	const parsed = parsePhoneNumber(candidate, regionCode ? { regionCode } : undefined);
	if (!parsed?.valid || !parsed.number?.e164 || !parsed.regionCode) return null;
	return {
		e164: parsed.number.e164,
		number: parsed.number.e164.slice(1),
		countryCode: parsed.regionCode,
		national: parsed.number.significant,
	};
};

/**
 * Normalize a phone number for Truecaller.
 *
 * Explicit +/00 international numbers work for every country supported by
 * libphonenumber. Local numbers use NG by default, or TRUECALLER_DEFAULT_COUNTRY.
 * A different local-country hint can be supplied as "GB 07123...".
 */
export const normalizeLookupNumber = (value, defaultCountry = process.env.TRUECALLER_DEFAULT_COUNTRY || DEFAULT_COUNTRY) => {
	let input = String(value || "").trim();
	let regionCode = cleanCountry(defaultCountry);
	const countryHint = input.match(/^([a-z]{2})\s*[:,-]?\s*(.+)$/i);
	if (countryHint) {
		regionCode = cleanCountry(countryHint[1]);
		input = countryHint[2];
	}

	input = input.replace(/(?:ext\.?|x)\s*\d+$/i, "").trim();
	const hasInternationalPrefix = input.startsWith("+") || input.startsWith("00");
	const digits = input.replace(/\D/g, "");
	if (!digits || digits.length < 7 || digits.length > 15) return null;

	if (hasInternationalPrefix) {
		return candidateResult(`+${digits.replace(/^00/, "")}`);
	}

	if (digits.startsWith("0")) {
		return candidateResult(digits, regionCode);
	}

	// First recognise a country calling code supplied without '+', such as
	// 234803..., 9198..., 447..., or 1415.... Then try a local number.
	return candidateResult(`+${digits}`) || candidateResult(digits, regionCode);
};

export const lookupNumberHelp = (prefix = "-") =>
	`Usage:\n${prefix}true 08031234567\n${prefix}true +2348031234567\n${prefix}true 2348031234567\n${prefix}true GB 07123456789\n\nLocal numbers default to Nigeria. Use +country-code for other countries.`;
