import * as authentication_request from './authentication-request'
import { HttpManager, RequestOptions } from './http-manager'

export namespace server_methods {
	/**
	 * Request an access token using the Client Credentials flow.
	 * Requires that client ID and client secret has been set previous to the call.
	 * @param {Object} options Options.
	 * @param {Function} [callback] Optional callback method to be called instead of the promise.
	 * @returns {Promise} A promise that if successful, resolves into an object containing the access token,
	 *          token type and time to expiration. If rejected, it contains an error object. Not returned if a callback is given.
	 */
	function clientCredentialsGrant(options: RequestOptions, callback: Function): Promise<any> {
		return authentication_request.builder()
			.withPath('/api/token')
			.withBodyParameters({
				'grant_type': 'client_credentials'
			})
			.withBodyParameters(options)
			.withHeaders({
				Authorization: 'Basic ' + new Buffer(this.getClientId() + ':' + this.getClientSecret()).toString('base64')
			})
			.build()
			.execute(HttpManager.post, callback);
	}

	/**
	 * Request an access token using the Authorization Code flow.
	 * Requires that client ID, client secret, and redirect URI has been set previous to the call.
	 * @param {string} code The authorization code returned in the callback in the Authorization Code flow.
	 * @param {Function} [callback] Optional callback method to be called instead of the promise.
	 * @returns {Promise} A promise that if successful, resolves into an object containing the access token,
	 *          refresh token, token type and time to expiration. If rejected, it contains an error object.
	 *          Not returned if a callback is given.
	 */
	function authorizationCodeGrant(code: string, callback: Function): Promise<any> {
		return authentication_request.builder()
			.withPath('/api/token')
			.withBodyParameters({
				'grant_type': 'authorization_code',
				'redirect_uri': this.getRedirectURI(),
				'code': code,
				'client_id': this.getClientId(),
				'client_secret': this.getClientSecret()
			})
			.build()
			.execute(HttpManager.post, callback);
	}

	/**
	 * Refresh the access token given that it hasn't expired.
	 * Requires that client ID, client secret and refresh token has been set previous to the call.
	 * @param {Function} [callback] Optional callback method to be called instead of the promise.
	 * @returns {Promise} A promise that if successful, resolves to an object containing the
	 *          access token, time to expiration and token type. If rejected, it contains an error object.
	 *          Not returned if a callback is given.
	 */
	function refreshAccessToken(callback: Function): Promise<any> {
		return authentication_request.builder()
			.withPath('/api/token')
			.withBodyParameters({
				'grant_type': 'refresh_token',
				'refresh_token': this.getRefreshToken()
			})
			.withHeaders({
				Authorization: ('Basic ' + new Buffer(this.getClientId() + ':' + this.getClientSecret()).toString('base64'))
			})
			.build()
			.execute(HttpManager.post, callback);
	}
}