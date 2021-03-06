/**
 * Copyright 2016 DanceDeets.
 *
 * @flow
 */

import React from 'react';
import url from 'url';
import FormatText from 'react-format-text';
import moment from 'moment';
import ExecutionEnvironment from 'exenv';
import upperFirst from 'lodash/upperFirst';
import isEqual from 'lodash/isEqual';
import { injectIntl, intlShape } from 'react-intl';
import { StickyContainer, Sticky } from 'react-sticky';
import Masonry from 'react-masonry-component';
import Slider from 'react-slick';
import Spinner from 'react-spinkit';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Collapse, { Panel } from 'rc-collapse';
import querystring from 'querystring';
import createBrowserHistory from 'history/createBrowserHistory';
import { performRequest as realPerformRequest } from 'dancedeets-common/js/api/dancedeets';
import { timeout } from 'dancedeets-common/js/api/timeouts';
import { sortNumber } from 'dancedeets-common/js/util/sort';
import { intlWeb } from 'dancedeets-common/js/intl';
import type { Cover, JSONObject } from 'dancedeets-common/js/events/models';
import { messages } from 'dancedeets-common/js/events/people';
import {
  BaseEvent,
  Event,
  SearchEvent,
} from 'dancedeets-common/js/events/models';
import type {
  NewSearchResponse,
  Onebox,
  PeopleListing,
  StylePersonLookup,
} from 'dancedeets-common/js/events/search';
import {
  formatAttending,
  groupEventsByStartDate,
} from 'dancedeets-common/js/events/helpers';
import { formatStartDateOnly } from 'dancedeets-common/js/dates';
import { JsonSchema } from './schema';
import { getEventSchema } from './schema/event';
import { getBreadcrumbsForSearch } from './schema/breadcrumbs';
import { Card, ImagePrefix, wantsWindowSizes } from './ui';
import type { windowProps } from './ui';
import { SquareEventFlyer } from './eventCommon';
import GoogleAd from './googleAd';
import { SearchBox, CalendarRatio } from './resultsCommon';
import {
  MultiSelectList,
  generateUniformState,
  caseInsensitiveSort,
  getSelected,
} from './MultiSelectList';
import type { MultiSelectState } from './MultiSelectList';

require('slick-carousel/slick/slick.css');
require('slick-carousel/slick/slick-theme.css');
require('../css/slick.scss');
require('../css/rc-collapse.scss');

type FormSearchQuery = {
  location?: string, // eslint-disable-line react/no-unused-prop-types
  keywords?: string, // eslint-disable-line react/no-unused-prop-types
  start?: string, // eslint-disable-line react/no-unused-prop-types
  end?: string, // eslint-disable-line react/no-unused-prop-types
};

function insertEvery<T>(
  array: Array<T>,
  insertion: (origIndex: number) => T,
  n: number
) {
  return array.reduce(
    (newArray, member, i) =>
      i % n === n - 1 // If it's our n'th element
        ? newArray.concat(member, insertion(i))
        : newArray.concat(member),
    []
  );
}

async function performRequest(
  path: string,
  args: Object,
  postArgs: ?Object | null
): Promise<Object> {
  return await realPerformRequest(window.fetch, path, args, postArgs, '2.0');
}

export class HorizontalEventFlyer extends React.Component {
  props: {
    event: BaseEvent,
  };

  generateCroppedCover(picture: Cover, width: number, height: number) {
    const parsedSource = url.parse(picture.source, true);
    parsedSource.query = { ...parsedSource.query, width, height };
    const newSourceUrl = url.format(parsedSource);

    return {
      source: newSourceUrl,
      width,
      height,
    };
  }

  render() {
    const event = this.props.event;
    const picture = event.picture;
    if (!picture) {
      return null;
    }
    const width = 800;
    const height = 400;

    const scaledHeight = '50'; // height == width * 50%

    const croppedPicture = this.generateCroppedCover(picture, width, height);
    const imageTag = (
      <div
        style={{
          height: 0,
          paddingBottom: `${scaledHeight}%`,
        }}
      >
        <img
          role="presentation"
          src={croppedPicture.source}
          style={{
            width: '100%',
          }}
          className="no-border"
        />
      </div>
    );
    return (
      <a className="link-event-flyer" href={event.getUrl()}>
        {imageTag}
      </a>
    );
  }
}

class _EventDescription extends React.Component {
  props: {
    event: SearchEvent,
    indexingBot?: boolean,

    // Self-managed props
    intl: intlShape,
  };

  render() {
    const event = this.props.event;
    const keywords = [...event.annotations.categories];
    if (this.props.indexingBot) {
      keywords.push(...event.annotations.keywords);
    }

    return (
      <div>
        <h3 className="event-title">
          <a href={event.getUrl()}>
            <span>{event.name}</span>
          </a>
        </h3>
        <div style={{ marginTop: 10 }}>
          <ImagePrefix
            icon={require('../img/categories-black.png')} // eslint-disable-line global-require
          >
            {keywords.join(', ')}
          </ImagePrefix>
        </div>
        <div>
          <ImagePrefix iconName="clock-o">
            {formatStartDateOnly(event.getListDateMoment(), this.props.intl)}
          </ImagePrefix>
        </div>

        <div>
          <ImagePrefix iconName="map-marker">
            <div>{event.venue.name}</div>
            <FormatText>{event.venue.cityStateCountry()}</FormatText>
          </ImagePrefix>
        </div>
      </div>
    );
  }
}
const EventDescription = injectIntl(_EventDescription);

class HorizontalEvent extends React.Component {
  props: {
    event: SearchEvent,
    lazyLoad: boolean,
  };

  render() {
    const event = this.props.event;
    return (
      <div>
        <div className="grey-top-border">{' '}</div>
        <div
          style={{
            paddingTop: 10,
            paddingBottom: 10,
            display: 'flex',
          }}
        >
          <div className="event-image" style={{ maxWidth: 180 + 2 }}>
            <SquareEventFlyer
              event={this.props.event}
              lazyLoad={this.props.lazyLoad}
            />
          </div>
          <div className="event-description" style={{ flex: 1 }}>
            <EventDescription event={this.props.event} />
          </div>
        </div>
      </div>
    );
  }
}

class VerticalEvent extends React.Component {
  props: {
    event: SearchEvent,
  };

  render() {
    const event = this.props.event;
    return (
      <Card
        style={{
          display: 'inline-block',
          width: 200,
          verticalAlign: 'top',
        }}
      >
        <SquareEventFlyer event={event} />
        <h3 className="event-title" style={{ marginTop: 10 }}>
          <a href={event.getUrl()}>
            <span>{event.name}</span>
          </a>
        </h3>
        <div className="event-city">
          <div>{event.venue.name}</div>
          <FormatText>{event.venue.cityStateCountry()}</FormatText>
        </div>
      </Card>
    );
  }
}

class FeaturedEvent extends React.Component {
  props: {
    event: BaseEvent,
  };

  render() {
    const event = this.props.event;
    return (
      <Card>
        <HorizontalEventFlyer event={event} />
        <h3 className="event-title" style={{ marginTop: 10 }}>
          <a href={event.getUrl()}>
            <span>{event.name}</span>
          </a>
        </h3>
      </Card>
    );
  }
}

class FeaturedEvents extends React.Component {
  props: {
    events: Array<BaseEvent>,
  };

  render() {
    if (!this.props.events.length) {
      return null;
    }

    const resultItems = [];
    const imageEvents = this.props.events.filter(x => x.picture);
    imageEvents.forEach((event, index) => {
      // Slider requires children to be actual HTML elements.
      resultItems.push(
        <div key={event.id}>
          <FeaturedEvent event={event} />
        </div>
      );
    });

    const results = resultItems.length > 1
      ? <Slider autoplay dots>{resultItems}</Slider>
      : resultItems;

    return (
      <div style={{ width: '100%', paddingLeft: 10, paddingRight: 10 }}>
        {results}
      </div>
    );
  }
}

class CurrentEvents extends React.Component {
  props: {
    events: Array<SearchEvent>,
  };

  render() {
    if (!this.props.events.length) {
      return null;
    }

    const resultItems = [];
    this.props.events.forEach((event, index) => {
      resultItems.push(<VerticalEvent key={event.id} event={event} />);
    });

    return (
      <div style={{ width: '100%', padding: 10 }}>
        <Masonry>
          {resultItems}
        </Masonry>
      </div>
    );
  }
}

class _EventsList extends React.Component {
  props: {
    events: Array<SearchEvent>,

    // Self-managed props
    intl: intlShape,
  };

  render() {
    const resultItems = [];
    let overallEventIndex = 0;
    groupEventsByStartDate(
      this.props.intl,
      this.props.events
    ).forEach(({ header, events }) => {
      const renderedEvents = events.map((event, index) =>
        <HorizontalEvent
          key={event.id}
          event={event}
          lazyLoad={overallEventIndex + index > 8}
        />
      );

      resultItems.push(
        <Sticky key={header}>
          <div className="bold" style={{ backgroundColor: 'white' }}>
            {header}
          </div>
        </Sticky>
      );
      resultItems.push(...renderedEvents);
      overallEventIndex += events.length;
    });

    // Make some arbitrary determination on what kinds of ads to use.
    const lastEvent = this.props.events[0];
    const adType = lastEvent
      ? Number(lastEvent.id[lastEvent.id.length - 1]) % 2
      : null;
    function adItem(origIndex) {
      switch (adType) {
        case 0:
          // Google Ad: search-inline-native
          return (
            <GoogleAd
              key={`ad-${origIndex}`}
              id={`ad-${origIndex}-adType-inline-native`}
              style={{ display: 'block' }}
              data-ad-format="fluid"
              data-ad-layout="image-side"
              data-ad-layout-key="-ef+o-2p-9x+sk"
              data-ad-slot="7215991777"
            />
          );
        case 1:
          // Google Ad: search-inline
          return (
            <GoogleAd
              key={`ad-${origIndex}`}
              id={`ad-${origIndex}-adType-inline`}
              style={{ display: 'block' }}
              data-ad-format="auto"
              data-ad-slot="8358307776"
            />
          );
        default:
          return null;
      }
    }
    const monetizedResultItems = insertEvery(resultItems, adItem, 10);

    return (
      <StickyContainer>
        {monetizedResultItems}
      </StickyContainer>
    );
  }
}
const EventsList = injectIntl(_EventsList);

class _OneboxLinks extends React.Component {
  props: {
    links: Array<Onebox>,
  };

  render() {
    if (!this.props.links.length) {
      return null;
    }
    const oneboxList = this.props.links.map(onebox =>
      <li key={onebox.url}>
        <a className="link-onebox" href={onebox.url}>{onebox.title}</a>
      </li>
    );

    return (
      <div>
        Featured Sites:
        <ul>{oneboxList}</ul>
      </div>
    );
  }
}
const OneboxLinks = injectIntl(_OneboxLinks);

class PersonList extends React.Component {
  props: {
    title: string,
    subtitle: string,
    categoryOrder: Array<string>,
    people: StylePersonLookup,
  };

  state: {
    category: string,
  };

  constructor(props) {
    super(props);
    this.state = {
      category: '',
    };
  }

  render() {
    if (!this.props.people[this.state.category]) {
      console.error(
        'PersonList: Found empty people for category:',
        this.state.category,
        'in people object:',
        this.props.people
      );
      return null;
    }
    const peopleList = this.props.people[this.state.category].slice(0, 10);
    const categories = this.props.categoryOrder.filter(
      x => x === '' || this.props.people[x]
    );

    const selector = (
      <form className="form-inline" style={{ padding: 5 }}>
        <b>{this.props.title} by Style: </b>
        <select
          className="form-control form-inline"
          onChange={e => this.setState({ category: e.target.value })}
        >
          {categories.map(x =>
            <option key={x} value={x}>{x || 'Overall'}</option>
          )}
        </select>
        <p><i>{this.props.subtitle}:</i></p>
      </form>
    );
    return (
      <div>
        {selector}
        <ul>
          {peopleList.map(x =>
            <li key={x.id}>
              <a href={`https://www.facebook.com/${x.id}`}>{x.name}</a>
            </li>
          )}
        </ul>
      </div>
    );
  }
}

class EventFilters extends React.Component {
  props: {
    events: Array<SearchEvent>,
    onChange: (filters: Array<string>) => void,
  };

  state: {
    initialStyles: Array<string>,
    styles: MultiSelectState,
  };

  constructor(props) {
    super(props);
    const styles = this.getStyles();
    this.state = {
      styles: generateUniformState(styles, true),
      initialStyles: styles,
    };
  }

  getStyles() {
    const categoryLookup = this.props.events.reduce((acc, e) => {
      const newAcc = { ...acc };
      e.annotations.categories.forEach(cat => {
        newAcc[cat] = true;
      });
      return newAcc;
    }, {});
    return Object.keys(categoryLookup);
  }

  render() {
    return (
      <MultiSelectList
        list={this.state.initialStyles}
        selected={this.state.styles}
        ref={x => {
          // this._styles = x;
        }}
        onChange={state => {
          this.setState({ styles: state });
          this.props.onChange(getSelected(state));
        }}
      />
    );
  }
}

class CallbackOnRender extends React.Component {
  props: {
    callback: () => void | Promise<void>,
    children?: React.Element<*>,
  };

  render() {
    if (this.props.callback) {
      this.props.callback();
    }
    return this.props.children;
  }
}

class Loading extends React.Component {
  props: {
    style?: Object,
  };

  render() {
    return (
      <div style={this.props.style}>
        <Spinner name="circle" color="black" fadeIn="none" />
      </div>
    );
  }
}

class ResultsList extends React.Component {
  props: {
    response: NewSearchResponse,
    showPast: boolean,
  };

  state: {
    filters: Array<String>,
  };

  constructor(props) {
    super(props);
    this.state = { filters: [] };
    (this: any).onChange = this.onChange.bind(this);
  }

  onChange(filters) {
    this.setState({ filters });
  }

  filterResults(events) {
    if (!this.state.filters.length) {
      return events;
    }
    const filterSet = new Set(this.state.filters);
    const foundEvents = events.filter(e => {
      const overlapCategories = e.annotations.categories.filter(cat =>
        filterSet.has(cat)
      );
      return overlapCategories.length;
    });
    return foundEvents;
  }

  render() {
    let resultEvents = this.props.response.results.map(
      eventData => new SearchEvent(eventData)
    );
    resultEvents = sortNumber(resultEvents, resultEvent =>
      resultEvent.getListDateMoment().valueOf()
    );
    const featuredInfos = (this.props.response.featuredInfos || [])
      .map(x => ({ ...x, event: new Event(x.event) }));

    resultEvents = this.filterResults(resultEvents);

    const now = moment();
    const eventPanels = [];
    let currentEvents = null;
    let fullEvents = null;
    if (this.props.showPast) {
      currentEvents = [];
      fullEvents = resultEvents;
    } else {
      // DEBUG CODE for current events:
      // currentEvents = resultEvents.filter(event => event.getStartMoment() > now);
      currentEvents = resultEvents.filter(event => {
        let end = event.getEndMoment();
        if (!end) {
          end = event.getStartMoment().add(2, 'hours');
        }
        return event.getListDateMoment().isBefore(now) && now.isBefore(end);
      });
      fullEvents = resultEvents.filter(event =>
        event.getListDateMoment().isAfter(now)
      );
    }
    if (currentEvents.length) {
      eventPanels.push(
        <div key="current">
          <div>Events happening now:</div>
          <CurrentEvents events={currentEvents} />
        </div>
      );
    }
    if (fullEvents.length) {
      eventPanels.push(<EventsList key="full" events={fullEvents} />);
    }

    let featuredPanel = null;
    if (featuredInfos.length) {
      featuredPanel = (
        <FeaturedEvents events={featuredInfos.map(x => x.event)} />
      );
    }

    let oneboxPanel = null;
    if (this.props.response.onebox_links.length) {
      oneboxPanel = <OneboxLinks links={this.props.response.onebox_links} />;
    }

    const eventFilters = global.window &&
      global.window.location.hash.includes('filter')
      ? <EventFilters events={resultEvents} onChange={this.onChange} />
      : null;

    return (
      <div style={{ backgroundColor: 'white', padding: 10 }}>
        {eventFilters}
        {featuredPanel}
        {oneboxPanel}
        {eventPanels}
        {resultEvents.map(x =>
          <JsonSchema key={x.id} json={getEventSchema(x)} />
        )}
      </div>
    );
  }
}

export async function search(
  location: string,
  keywords: string,
  start: string,
  end: string
) {
  const args = {};
  if (location) {
    args.location = location;
  }
  if (keywords) {
    args.keywords = keywords;
  }
  if (start) {
    args.start = start;
  }
  if (end) {
    args.end = end;
  }

  const response = await performRequest(
    'search',
    {
      ...args,
      skip_people: 1, // We don't need to auto-fetch people, since it is on a different tab
    },
    {}
  );
  response.featuredInfos = response.featuredInfos.map(x => ({
    ...x,
    event: new SearchEvent(x.event),
  }));
  response.results = response.results.map(x => new SearchEvent(x));
  return response;
}

class _PeopleList extends React.Component {
  props: {
    response: NewSearchResponse,
    categoryOrder: Array<string>,

    // Self-managed props
    intl: intlShape,
  };

  state: {
    people: PeopleListing,
    failed: boolean,
  };

  _loadingPeople: boolean;

  constructor(props) {
    super(props);
    this.state = { people: props.response.people, failed: false };
    (this: any).loadPeopleIfNeeded = this.loadPeopleIfNeeded.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    this.setState({ people: nextProps.response.people, failed: false });
  }

  async loadPeopleIfNeeded() {
    if (
      // If we're rendering on the server, ignore loading anything
      !ExecutionEnvironment.canUseDOM ||
      // This search area was too large, and we didn't want to do a people calculation
      !this.state.people ||
      // We already have some people loaded, no need to load them again
      Object.keys(this.state.people).length ||
      // We have an in-progress pending load
      this._loadingPeople
    ) {
      return;
    }
    try {
      this._loadingPeople = true;
      const args = {
        location: this.props.response.query.location,
        locale: this.props.response.query.locale,
      };
      const response = await performRequest('people', args, args);
      this.setState({ people: response.people });
    } catch (e) {
      console.error(e);
      this.setState({ failed: true });
    }
    this._loadingPeople = false;
  }

  render() {
    let adminContents = null;
    let attendeeContents = null;
    if (this.state.people) {
      const admins = this.state.people.ADMIN;
      const attendees = this.state.people.ATTENDEE;
      if (!admins && !attendees) {
        return (
          <CallbackOnRender callback={this.loadPeopleIfNeeded}>
            <Loading style={{ margin: 50 }} />
          </CallbackOnRender>
        );
      } else {
        adminContents = admins
          ? <PersonList
              title={this.props.intl.formatMessage(messages.nearbyPromoters)}
              subtitle={this.props.intl.formatMessage(
                messages.nearbyPromotersMessage
              )}
              people={admins}
              categoryOrder={this.props.categoryOrder}
            />
          : null;
        attendeeContents = attendees
          ? <PersonList
              title={this.props.intl.formatMessage(messages.nearbyDancers)}
              subtitle={this.props.intl.formatMessage(
                messages.nearbyDancersMessage
              )}
              people={attendees}
              categoryOrder={this.props.categoryOrder}
            />
          : null;
      }
    } else if (this.state.failed) {
      adminContents = <span>Error Loading People</span>;
      attendeeContents = <span>Error Loading People</span>;
    } else {
      adminContents = null;
      attendeeContents = null;
    }

    const adminsDiv = adminContents
      ? <div className="col-sm-6">{adminContents}</div>
      : null;
    const attendeesDiv = attendeeContents
      ? <div className="col-sm-6">{attendeeContents}</div>
      : null;
    return <div className="row">{adminsDiv}{attendeesDiv}</div>;
  }
}
const PeopleList = injectIntl(_PeopleList);

class _Calendar extends React.Component {
  props: {
    query: FormSearchQuery,

    // Self-managed props
    window: windowProps,
  };

  render() {
    const query = querystring.stringify(this.props.query);
    const calendarUrl = `/calendar/iframe?${query}`;
    const height = this.props.window
      ? this.props.window.width / CalendarRatio
      : 500;
    return (
      <iframe
        src={calendarUrl}
        style={{
          width: '100%',
          height,
          border: 0,
          borderBottom: '1px solid lightgrey',
        }}
      />
    );
  }
}
const Calendar = wantsWindowSizes(_Calendar);

class ResultTabs extends React.Component {
  props: {
    response: NewSearchResponse,
    query: FormSearchQuery,
    loading: boolean,
    categoryOrder: Array<string>,
  };

  render() {
    const overlayDiv = this.props.loading
      ? <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
          }}
        />
      : null;
    const tabPanelStyle = {
      position: 'relative',
    };
    let peopleTab = null;
    let peopleTabPanel = null;
    // Only show People tab if we have chosen a location
    if (this.props.query.location) {
      peopleTab = <Tab>People</Tab>;
      // It seems every time we re-render this tab...it is fully reconstructed,
      // and loses its state (and the associated downloaded People data).
      // TODO: We should do a better job of preserving Tab state (redux?).
      peopleTabPanel = (
        <TabPanel style={tabPanelStyle}>
          <PeopleList
            response={this.props.response}
            categoryOrder={this.props.categoryOrder}
          />
          {overlayDiv}
        </TabPanel>
      );
    }

    const queryStart = this.props.query.start
      ? moment(this.props.query.start)
      : null;
    const queryEnd = this.props.query.end ? moment(this.props.query.end) : null;
    const now = moment();
    const showPast = Boolean(
      (queryStart && queryStart.isBefore(now)) ||
        (queryEnd && queryEnd.isBefore(now))
    );

    return (
      <Tabs>
        <TabList>
          <Tab>Events List</Tab>
          <Tab>Calendar</Tab>
          {peopleTab}
        </TabList>

        <TabPanel style={tabPanelStyle}>
          <ResultsList response={this.props.response} showPast={showPast} />
          {overlayDiv}
        </TabPanel>
        <TabPanel style={tabPanelStyle}>
          <Calendar query={this.props.query} />
          {overlayDiv}
        </TabPanel>
        {peopleTabPanel}
      </Tabs>
    );
  }
}

function canonicalizeQuery(query) {
  const newQuery = {};
  ['location', 'keywords', 'start', 'end'].forEach(key => {
    if (query[key] && query[key].length) {
      newQuery[key] = query[key];
    }
  });
  return newQuery;
}

class ResultsPage extends React.Component {
  props: {
    response: NewSearchResponse,
    categoryOrder: Array<string>,
    query: Object,
  };

  state: {
    loading: boolean,
    query: FormSearchQuery,
    response: NewSearchResponse,
  };

  constructor(props) {
    super(props);
    this.state = {
      response: this.props.response,
      query: canonicalizeQuery(this.props.query),
      loading: false,
    };
    (this: any).onNewSearch = this.onNewSearch.bind(this);
  }

  async onNewSearch(query: Object) {
    const newQuery = canonicalizeQuery(query);
    // Only re-search when the query has changed
    if (isEqual(newQuery, this.state.query)) {
      return;
    }

    const newQueryString = querystring.stringify(newQuery);
    const oldQueryString = new URL(window.location.href).search;
    // Try to avoid calling history.replace if the query string is the same
    // Each new location change, triggers a reload of the page favicons
    if (newQueryString !== oldQueryString) {
      const history = createBrowserHistory();
      history.replace(`/?${newQueryString}`);
    }

    await this.setState({ query: newQuery, loading: true });
    const response = await search(
      query.location,
      query.keywords,
      query.start,
      query.end
    );
    await this.setState({ response, loading: false });
  }

  render() {
    const resultsCard = (
      <Card style={{ margin: 0, padding: 0 }}>
        <JsonSchema
          json={getBreadcrumbsForSearch(
            this.state.response.address,
            this.state.response.query.keywords
          )}
        />
        <ResultTabs
          query={this.state.query}
          loading={this.state.loading}
          response={this.state.response}
          categoryOrder={this.props.categoryOrder}
        />
      </Card>
    );
    const sideAd = (
      <GoogleAd
        style={{ display: 'inline-block', width: 300, height: 600 }}
        data-ad-slot="6881574572"
      />
    );
    return (
      <div>
        <div className="container">
          <div className="row" style={{ marginTop: 20, marginBottom: 50 }}>
            <div className="col-xs-12">
              <SearchBox
                query={this.props.query}
                onNewSearch={this.onNewSearch}
              />
            </div>
          </div>
          <div className="row">
            <div className="col-md-8">
              {resultsCard}
            </div>
            <div className="col-md-4 hidden-xs hidden-sm">
              {sideAd}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default intlWeb(ResultsPage);
