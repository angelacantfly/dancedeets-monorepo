#!/usr/bin/env python

import logging
import time

import base_servlet
from logic import friends
from logic import rsvp
from rankings import rankings
from util import dates
from . import search
from . import search_base
from . import search_pages

class SearchHandler(base_servlet.BaseRequestHandler):
    def requires_login(self):
        if not self.request.get('location') and not self.request.get('keywords'):
            return True
        return False

    def get(self, *args, **kwargs):
        self.handle(*args, **kwargs)

    def post(self, *args, **kwargs):
        self.handle(*args, **kwargs)

    def handle(self, city_name=None):
        self.finish_preload()
        if self.user and not self.user.location:
            #TODO(lambert): make this an error
            self.user.add_message("We could not retrieve your location from facebook. Please fill out a location below")
            self.redirect('/user/edit')
            return

        fe_search_query = search_base.FrontendSearchQuery.create_from_request_and_user(self.request, self.user)
        self.handle_search(fe_search_query)

    def _fill_ranking_display(self, fe_search_query):
        a = time.time()
        ranking_location = rankings.get_ranking_location(fe_search_query.location)
        logging.info("computing largest nearby city took %s seconds", time.time() - a)

        a = time.time()
        #TODO(lambert): perhaps produce optimized versions of these without styles/times, for use on the homepage? less pickling/loading required
        event_top_n_cities, event_selected_n_cities = rankings.top_n_with_selected(rankings.get_thing_ranking(rankings.get_city_by_event_rankings(), rankings.ALL_TIME), ranking_location)
        user_top_n_cities, user_selected_n_cities = rankings.top_n_with_selected(rankings.get_thing_ranking(rankings.get_city_by_user_rankings(), rankings.ALL_TIME), ranking_location)
        logging.info("Sorting and ranking top-N cities took %s seconds", time.time() - a)

        self.display['user_top_n_cities'] = user_top_n_cities
        self.display['event_top_n_cities'] = event_top_n_cities
        self.display['user_selected_n_cities'] = user_selected_n_cities
        self.display['event_selected_n_cities'] = event_selected_n_cities

class RelevantHandler(SearchHandler):
    def handle_search(self, fe_search_query):
        validation_errors = fe_search_query.validation_errors()
        if validation_errors:
            self.add_error('Invalid search query: %s' % ', '.join(validation_errors))

        if not self.request.get('calendar'):
            search_query = search.SearchQuery.create_from_query(fe_search_query)
            if fe_search_query.validated:
                search_results = search_query.get_search_results(self.fbl)
            else:
                search_results = []
            # We can probably speed this up 2x by shrinking the size of the fb-event-attending objects. a list of {u'id': u'100001860311009', u'name': u'Dance InMinistry', u'rsvp_status': u'attending'} is 50% overkill.
            a = time.time()
            friends.decorate_with_friends(self.fbl, search_results)
            logging.info("Decorating with friends-attending took %s seconds", time.time() - a)
            a = time.time()
            rsvp.decorate_with_rsvps(self.fbl, search_results)
            logging.info("Decorating with personal rsvp data took %s seconds", time.time() - a)

            past_results, present_results, grouped_results = search.group_results(search_results)
            if search_query.time_period == dates.TIME_FUTURE:
                present_results = past_results + present_results
                past_results = []

            self.display['num_upcoming_results'] = sum([len(x.results) for x in grouped_results]) + len(present_results)
            self.display['past_results'] = past_results
            self.display['ongoing_results'] = present_results
            self.display['grouped_upcoming_results'] = grouped_results

        if fe_search_query.time_period == search_base.TIME_PAST:
            self.display['selected_tab'] = 'past'
        elif self.request.get('calendar'):
            self.display['selected_tab'] = 'calendar'
        else:
            self.display['selected_tab'] = 'present'

        self._fill_ranking_display(fe_search_query)

        self.display['defaults'] = fe_search_query
        if fe_search_query.location and fe_search_query.keywords:
            self.display['result_title'] = '%s dance events near %s' % (fe_search_query.keywords, fe_search_query.location)
        elif fe_search_query.location:
            self.display['result_title'] = '%s dance events' % fe_search_query.location
        elif fe_search_query.keywords:
            self.display['result_title'] = '%s dance events' % fe_search_query.keywords
        else:
            self.display['result_title'] = 'Dance events'

        request_params = fe_search_query.url_params()
        if 'calendar' in request_params:
            del request_params['calendar'] #TODO(lambert): clean this up more
        if 'past' in request_params:
            del request_params['past'] #TODO(lambert): clean this up more
        self.display['past_view_url'] = '/events/relevant?past=1&%s' % '&'.join('%s=%s' % (k, v) for (k, v) in request_params.iteritems())
        self.display['upcoming_view_url'] = '/events/relevant?%s' % '&'.join('%s=%s' % (k, v) for (k, v) in request_params.iteritems())
        self.display['calendar_view_url'] = '/events/relevant?calendar=1&%s' % '&'.join('%s=%s' % (k, v) for (k, v) in request_params.iteritems())
        self.display['calendar_feed_url'] = '/calendar/feed?%s' % '&'.join('%s=%s' % (k, v) for (k, v) in request_params.iteritems())

        self.display['CHOOSE_RSVPS'] = self.jinja_env.globals['CHOOSE_RSVPS'] = rsvp.CHOOSE_RSVPS
        self.render_template('results')

class CityHandler(RelevantHandler):
    def requires_login(self):
        return False

    def handle(self, city_name):
        # TODO(lambert): Why is this still required, can we get rid of it?
        self.fbl.batch_fetch() # to avoid bad error handler?
        fe_search_query = search_base.FrontendSearchQuery()
        fe_search_query.location = city_name
        fe_search_query.distance = 50
        fe_search_query.distance_units = 'miles'
        self.handle_search(fe_search_query)


class RelevantPageHandler(SearchHandler):
    def requires_login(self):
        if not self.request.get('location') and not self.request.get('keywords'):
            return True
        return False

    def get(self, *args, **kwargs):
        self.handle(*args, **kwargs)

    def post(self, *args, **kwargs):
        self.handle(*args, **kwargs)

    def handle(self, city_name=None):
        self.finish_preload()
        if self.user and not self.user.location:
            #TODO(lambert): make this an error
            self.user.add_message("We could not retrieve your location from facebook. Please fill out a location below")
            self.redirect('/user/edit')
            return

        fe_search_query = search_base.FrontendSearchQuery.create_from_request_and_user(self.request, self.user)
        self.handle_search(fe_search_query)

    def handle_search(self, fe_search_query):
        validation_errors = fe_search_query.validation_errors()
        if validation_errors:
            self.add_error('Invalid search query: %s' % ', '.join(validation_errors))

        search_query = search_pages.SearchPageQuery.create_from_query(fe_search_query)
        if fe_search_query.validated:
            search_results = search_query.get_search_results(self.fbl)
        else:
            search_results = []

        self.display['page_results'] = search_results

        self.display['selected_tab'] = 'pages'

        self._fill_ranking_display(fe_search_query)

        self.display['defaults'] = fe_search_query
        if fe_search_query.location and fe_search_query.keywords:
            self.display['result_title'] = 'Facebook Pages near %s containing %s' % (fe_search_query.location, fe_search_query.keywords)
        elif fe_search_query.location:
            self.display['result_title'] = 'Facebook Pages near %s' % fe_search_query.location
        elif fe_search_query.keywords:
            self.display['result_title'] = 'Facebook Pages containing %s' % fe_search_query.keywords
        else:
            self.display['result_title'] = 'Facebook Pages'

        request_params = fe_search_query.url_params()
        if 'calendar' in request_params:
            del request_params['calendar'] #TODO(lambert): clean this up more
        if 'past' in request_params:
            del request_params['past'] #TODO(lambert): clean this up more
        self.display['past_view_url'] = '/events/relevant?past=1&%s' % '&'.join('%s=%s' % (k, v) for (k, v) in request_params.iteritems())
        self.display['upcoming_view_url'] = '/events/relevant?%s' % '&'.join('%s=%s' % (k, v) for (k, v) in request_params.iteritems())
        self.display['calendar_view_url'] = '/events/relevant?calendar=1&%s' % '&'.join('%s=%s' % (k, v) for (k, v) in request_params.iteritems())
        self.display['calendar_feed_url'] = '/calendar/feed?%s' % '&'.join('%s=%s' % (k, v) for (k, v) in request_params.iteritems())

        self.render_template('results_pages')
