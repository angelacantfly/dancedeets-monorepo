import logging

import twitter

import fb_api
from events import eventdata
from logic import event_classifier
from logic import event_locations
from logic import event_updates
from logic import potential_events
from logic import pubsub
from logic import thing_db

class AddEventException(Exception):
    pass

def add_update_event(event_id, user_id, fbl, remapped_address=None, override_address=None, creating_method=None):
    event_id = str(event_id)
    fbl.request(fb_api.LookupEvent, event_id, allow_cache=False)
    #DISABLE_ATTENDING
    #fbl.request(fb_api.LookupEventAttending, event_id, allow_cache=False)
    fbl.batch_fetch()

    fb_event = fbl.fetched_data(fb_api.LookupEvent, event_id)
    #DISABLE_ATTENDING
    fb_event_attending = None
    #fb_event_attending = fbl.fetched_data(fb_api.LookupEventAttending, event_id)
    if not fb_api.is_public_ish(fb_event):
        raise AddEventException('Cannot add secret/closed events to dancedeets!')

    if remapped_address is not None:
        event_locations.update_remapped_address(fb_event, remapped_address)

    e = eventdata.DBEvent.get_or_insert(event_id)
    newly_created = (not e.creating_fb_uid)
    if override_address is not None:
        e.address = override_address
    e.creating_fb_uid = user_id
    if creating_method:
        e.creating_method = creating_method
    event_updates.update_and_save_event(e, fb_event)
    thing_db.create_source_from_event(fbl, e)

    if newly_created:
        logging.info("New event, publishing to twitter/facebook")
        # When we want to support complex queries on many types of events, perhaps we should use Prospective Search.
        auth_tokens = pubsub.OAuthToken.query(pubsub.OAuthToken.user_id=="701004", pubsub.OAuthToken.application==pubsub.APP_TWITTER, pubsub.OAuthToken.token_nickname=="BigTwitter").fetch(1)
        if auth_tokens:
            try:
                pubsub.twitter_post(auth_tokens[0], e, fb_event)
            except twitter.TwitterError as e:
                logging.error("Twitter Post Error: %s", e)
        else:
            logging.error("Could not find Mike's BigTwitter OAuthToken")
        auth_tokens = pubsub.OAuthToken.query(pubsub.OAuthToken.user_id=="701004", pubsub.OAuthToken.application==pubsub.APP_FACEBOOK).fetch(5)
        if auth_tokens:
            filtered_auth_tokens = [x for x in auth_tokens if x.token_nickname in ["1613128148918160", "1375421172766829"]]
            if filtered_auth_tokens:
                auth_token = filtered_auth_tokens[0]
                result = pubsub.facebook_post(auth_token, e, fb_event)
                logging.info("Facebook result was %s", result)
                if 'error' in result:
                    logging.error("Facebook Post Error: %s", result)
            else:
                logging.error("Couldn't find good Facebook tokens to pubulish to: %s", auth_tokens)
        else:
            logging.error("Could not find a Facebook token")

    potential_event = potential_events.make_potential_event_without_source(event_id, fb_event, fb_event_attending)
    classified_event = event_classifier.get_classified_event(fb_event, potential_event.language)
    if potential_event:
        for source_id in potential_event.source_ids:
            thing_db.increment_num_real_events(source_id)
            if not classified_event.is_dance_event():
                thing_db.increment_num_false_negatives(source_id)
    # Hmm, how do we implement this one?# thing_db.increment_num_real_events_without_potential_events(source_id)
    return fb_event, e
