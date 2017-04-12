
# We import these for their side-effects in adding routes to the wsgi app
from battle_brackets import signup_servlets
from brackets import servlets
from classes import class_pipeline
from classes import class_servlets
from event_attendees import popular_people
from event_scraper import keyword_search
from event_scraper import source_servlets
from event_scraper import scraping_tasks
from event_scraper import thing_scraper2
from event_scraper import webhooks
from events import event_reloading_tasks
from events import find_access_tokens
from logic import unique_attendees
from ml import gprediction_servlets
from notifications import added_events
from notifications import rsvped_events
import pubsub.pubsub_setup
import pubsub.facebook.auth_setup
import pubsub.twitter.auth_setup
from rankings import rankings_servlets
from search import search_servlets
from search import search_tasks
from search import style_servlets
from search import search_source
from servlets import admin
from servlets import api
from servlets import calendar
from servlets import event
from servlets import event_proxy
from servlets import feedback
from servlets import login
from servlets import mobile_apps
from servlets import private_apis
from servlets import promote
from servlets import profile_page
from servlets import static
from servlets import static_db
from servlets import tools
from servlets import warmup
from servlets import youtube_simple_api
from topics import topic_servlets
from tutorials import servlets
from users import user_event_tasks
from users import user_servlets
from users import user_tasks
from util import batched_mapperworker
from util import ah_handlers
from web_events import fb_events_servlets
from web_events import web_events_servlets
