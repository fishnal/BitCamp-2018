// Handles request errors from the Spotify Web API

/**
 * Gets an error message based on the error object in the request object.
 *
 * @param {Request} req the request object.
 * @returns {string} the appropriate error message.
 */
function handleSpotifyError(req) {
	switch (req.statusCode) {
	default: 	return "Unknown error code";
	case 400: 	return "[400] A bad request was made, check the request again";
	case 401:	return "[401] You need to authorize the application first";
	case 403:	return "[403] Request was denied";
	case 404: 	return "[404] Unknown request";
	case 429:	return `[429] Too many requests, try again in ${req.headers['retry-after']}`
		+ `seconds`;
	case 500:	return "[500] Internal server error, report to Spotify";
	case 503:	return "[503] The service wasn't available, but you can try again";
	}
}
