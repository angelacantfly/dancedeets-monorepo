#!/usr/bin/env python

from events import users
import base_servlet

#TODO(lambert): send weekly emails with upcoming events per person
#TODO(lambert): send notifications to interested users when someone adds a new event?

        
class UserHandler(base_servlet.BaseRequestHandler):
    def get(self):
        self.batch_lookup.finish_loading()

        self.display['DANCES'] = users.DANCES
        self.display['DANCE_HEADERS'] = users.DANCE_HEADERS
        self.display['DANCE_LISTS'] = users.DANCE_LISTS

        defaults = {
            'zip': '',
            'freestyle': users.FREESTYLE_FAN_NO_CLUBS,
            'choreo': users.CHOREO_FAN,
            'send_email': True,
            'distance': '60',
            # TODO(lambert): Autoselect this based on facebook location. Only UK/US get 'miles' ?
            'distance_units': 'miles',
        }
        fetched_users = users.User.gql('where fb_uid = :fb_uid', fb_uid=self.facebook.uid).fetch(1)
        if fetched_users:
            user = fetched_users[0]
            for k in defaults:
                defaults[k] = getattr(user, k)
        for field in defaults.keys():
            if self.request.get(field):
                defaults[field] = self.request.get(field)
        self.display['defaults'] = defaults
        self.display['location'] = self.batch_lookup.users[self.facebook.uid]['profile']['location']['name']
        self.render_template('events.templates.user')

    def post(self):
        #if not validated:
        #    self.get()
        fetched_users = users.User.gql('where fb_uid = :fb_uid', fb_uid=self.facebook.uid).fetch(1)
        if fetched_users:
            user = fetched_users[0]
        else:
            user = users.User(fb_uid=self.facebook.uid)
        for field in ['zip', 'freestyle', 'choreo', 'distance', 'distance_units']:
            form_value = self.request.get(field)
            setattr(user, field, form_value)
        for field in ['send_email']:
            form_value = self.request.get(field) == "true"
            setattr(user, field, form_value)
        user.put()
        self.redirect('/user/edit')
