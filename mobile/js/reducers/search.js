/**
 * Copyright 2016 DanceDeets.
 *
 * @flow
 */

import { Dimensions } from 'react-native';
import type {
  SearchQuery,
  SearchResponse,
} from 'dancedeets-common/js/events/search';
import type { Action } from '../actions/types';

export type State = {
  loading: boolean, // loading indicator
  searchQuery: SearchQuery, // our current search query
  response: ?SearchResponse, // our last-searched response
  error: boolean, // whether there was an error fetching the current results
};

const initialState = {
  loading: false,
  searchQuery: {
    location: '',
    keywords: '',
    timePeriod: 'ALL_FUTURE',
  },
  response: null,
  error: false,
};

export function search(state: State = initialState, action: Action): State {
  if (action.type === 'LOGIN_LOGGED_OUT') {
    return initialState;
  }
  if (
    action.type === 'UPDATE_LOCATION' ||
    // Only set location from GPS if user hasn't entered any location
    (action.type === 'DETECTED_LOCATION' && state.searchQuery.location === '')
  ) {
    const searchQuery = {
      ...state.searchQuery,
      location: action.location,
    };
    return {
      ...state,
      searchQuery,
    };
  }
  if (action.type === 'UPDATE_KEYWORDS') {
    const searchQuery = {
      ...state.searchQuery,
      keywords: action.keywords,
    };
    return {
      ...state,
      searchQuery,
    };
  }
  if (action.type === 'START_SEARCH') {
    return {
      ...state,
      loading: true,
      error: false,
    };
  }
  if (action.type === 'SEARCH_COMPLETE') {
    return {
      ...state,
      loading: false,
      response: action.response,
    };
  }
  if (action.type === 'SEARCH_FAILED') {
    return {
      ...state,
      loading: false,
      response: null,
      error: true,
    };
  }
  return state;
}
