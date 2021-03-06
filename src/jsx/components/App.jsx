import * as React from 'react';
import PropTypes from 'prop-types';
import * as axios from 'axios';
import * as Cookies from 'js-cookie';
import BadStateCode from './errors/BadStateCode';
import FailedAuth from './errors/FailedAuth';
import FailedTokens from './errors/FailedTokens';
import FailedRefresh from './errors/FailedRefresh';
import Authorizer from './Authorizer';
import Loading from './Loading';
import Recorder from './recorder/Recorder';
import * as PSQProps from '../props/psq';
import { getServerURL, randString } from './../utils';
import AsyncController from './../async_controller';
import PlaylistSelector from './selector/PlaylistSelector';
import * as SpotifyWebApiExport from 'spotify-web-api-js';

const SpotifyWebApi = SpotifyWebApiExport.default;

const CLIENT_ID = 'acd0f18a3e124101af31f9b3582130c6';
const SCOPES = [
  "streaming",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-read-birthdate",
  "user-read-email",
  "user-read-private"
];
const CODES = {
  BAD_STATE: 1,
  FAILED_AUTH: 2,
  FAILED_TOKENS: 3,
  FAILED_REFRESH: 4
}

function refreshCheck() {
  return !Cookies.get('access_token') || !Cookies.get('psq_token');
}

export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.refresh = this.refresh.bind(this);
    this.getTokens = this.getTokens.bind(this);

    this.state = {
      tokens: this.props.tokens,
      spotifyApi: new SpotifyWebApi({}),
      asyncController: new AsyncController(this.refresh, refreshCheck)
    };
  }

  /**
   * Refreshes/retrieves another access token using an existing refresh token asynchronously.
   *
   * @param {boolean} replace an indicator to resolve with null, which indicates to refresh the page
   * @returns {Promise<void>} a Promise for the refresh request made; resolves when it updates this
   * component's state tokens to the refreshed ones, fails if the request fails
   */
  refresh(replace) {
    let { tokens } = this.state;
    let _this = this;

    return new Promise(function(resolve, reject) {
      axios.post(`/api/refresh?psq_token=${tokens.psq}`).then(function(resp) {
        let { data } = resp;

        // store access and refresh tokens in cookies
        // access token expires in (tokenData["expires_in"] - 120 seconds)
        let accessExpireTime = data.expires_in - 120;

        Cookies.set(
          'access_token',
          tokens.access = data.access_token,
          { expires: accessExpireTime / 86400 }
        );
        Cookies.set(
          'psq_token',
          tokens.psq = data.psq_token,
          {expires: 365 }
        );

        _this.state.spotifyApi.setAccessToken(tokens.access);

        _this.setState({ tokens }, function() {
          if (replace) {
            resolve(null);
          } else {
            resolve(resp);
          }
        });
      }).catch(reject);
    });
  }

  /**
   * Gets Spotify API tokens.
   * @param {String} code the Spotify authentication code
   * @returns {Promise<void>} a Promise for the request made to retrieve the API token; resolves
   * when it updates the state of this component to have the valid tokens, and rejects on any errors
   * that occur while making the request.
   */
  getTokens(code) {
    let { tokens } = this.state;
    let _this = this;

    return new Promise(function(resolve, reject) {
      axios.get(`/api/token?code=${code}`).then(function(resp) {
        let { data } = resp;

        // store access and refresh tokens in cookies

        // refresh token cookie expires in 365 days (1 year), so users don't
        // have to reauthorize again (unless they logout)
        Cookies.set(
          "refresh_token",
          tokens.refresh = data.refresh_token,
          { expires: 365 }
        );

        // access token cookie expires 4 minutes before the actual token
        Cookies.set(
          "access_token",
          tokens.access = data.access_token,
          { expires: (data.expires_in - 240) / 86400 } // converting to days
        );

        // psq token cookie expires in 365 days (same reason as refresh token)
        Cookies.set(
          "psq_token",
          tokens.psq = data.psq_token,
          { expires: 365 }
        );

        _this.state.spotifyApi.setAccessToken(tokens.access);

        _this.setState({ tokens }, resolve);
      }).catch(reject);
    });
  }

  componentDidMount() {
    let { code, queryState, error } = this.props;
    let { tokens } = this.state;
    let state = Cookies.get('state');
    let _this = this;

    // equivalent to !(queryState && (!tokens.access || !tokens.refresh)) && tokens.refresh && !tokens.access
    if (!queryState && !tokens.access && tokens.refresh) {
      // refresh when we have a refresh token but not a query state or access token
      this.refresh(true).then(function(newTokens) {
        if (!newTokens) {
          window.location.replace(getServerURL());
        }
      }).catch(function(err) {
        // code 4
        console.error(err);
        // TODO get status code and error description from error
        let newState = {
          tokens,
          status: CODES.FAILED_REFRESH,
          err
        }
        _this.setState(newState);
      });
    } else if (!error && !state && queryState) {
      // get tokens if no errors and no cookie state and query state still exists
      this.getTokens(code).then(function() {
        // go to main page, clears up any query params present in URL
        window.location.replace(getServerURL());
      }).catch(function(err) {
        console.error(err);
        // TODO extract status code and error description from err
        let newState = {
          tokens: _this.state.tokens,
          status: CODES.FAILED_TOKENS,
          err
        };
        _this.setState(newState);
      });
    }
  }

  // TODO cancel any async requests when component is unmounting?

  render() {
    let { code, error, queryState } = this.props;
    let { tokens, status } = this.state;
    let state = Cookies.get('state');

    if (status === CODES.FAILED_TOKENS) {
      // code 3
      return (<FailedTokens error={this.state.err} />);
    } else if (status === CODES.FAILED_REFRESH) {
      // code 4
      return (<FailedRefresh error={this.state.err} />);
    } else if (queryState && (!tokens.access || !tokens.refresh)) {
      // state was returned in query, verify it matches the one in the cookie
      if (state && queryState !== state) {
        // bad query state (either previous state expired or it just doesn't match)
        // code 1
        this.setState({ tokens, status: CODES.BAD_STATE });
        return (<BadStateCode />);
      } else if (error) {
        // code 2
        this.setState({ tokens, status: CODES.FAILED_AUTH });
        return (<FailedAuth error={error}/>);
      } else {
        Cookies.remove('state');
        return (<Loading />);
      }
    }

    if (!tokens.refresh) {
      // no refresh token, auth user again so we can get one

      if (!state) {
        // no state, generate one and have it expire in 5 mins
        Cookies.set('state', state = randString(4), {expires: 5 / 1440 });
      }

      return <Authorizer CLIENT_ID={CLIENT_ID} SCOPES={SCOPES} state={state}/>
    } else if (!tokens.access) {
      // no access token, refresh to get one
      // show something that indicates to the user the page is loading, so we can get the refreshed
      // data in the background
      return (<Loading />);
    } else if (!code && !queryState && !error) {
      this.state.spotifyApi.setAccessToken(tokens.access);
      return (
        <div>
          <Recorder spotifyApi={this.state.spotifyApi} asyncController={this.state.asyncController} />
          <PlaylistSelector spotifyApi={this.state.spotifyApi} asyncController={this.state.asyncController} />
        </div>
      );
    } else {
      return (<Loading />);
    }
  }
}

App.propTypes = {
  code: PropTypes.string,
  queryState: PropTypes.string,
  error: PropTypes.string,
  tokens: PSQProps.Tokens.isRequired
};
