from google.appengine.ext import db


def header_item(name, description):
    return dict(name=name, description=description)

def list_item(internal, name, description):
    return dict(internal=internal, name=name, description=description)

FREESTYLE_DANCER = 'FREESTYLE_DANCER'
FREESTYLE_FAN_WITH_CLUBS = 'FREESTYLE_FAN_WITH_CLUBS'
FREESTYLE_FAN_NO_CLUBS = 'FREESTYLE_FAN_NO_CLUBS'
FREESTYLE_APATHY = 'FREESTYLE_APATHY'

FREESTYLE_HEADER = header_item("Freestyle", "Street Dances: breaking, house dancing, popping and locking, waacking and vogue, old school hiphop, etc.")
FREESTYLE_LIST = [
    list_item(FREESTYLE_APATHY, "Freestyle Apathy", "You're not a fan of freestyle stuff, it's just not your scene."),
    list_item(FREESTYLE_FAN_NO_CLUBS, "Freestyle Fan, No Clubs", "You love watching performances, jams, and battles."),
    list_item(FREESTYLE_FAN_WITH_CLUBS, "Freestyle Fan, With Clubs", "In addition to performances, battles, and jams, you love going to the clubs to watch and absorb the vibe, even if you don't dance."),
    list_item(FREESTYLE_DANCER, "Freestyle Dancer", "Not just a fan of freestyle stuff, but a dancer as well. You're interested in workshops, practice sessions, auditions, and other venues for learning."),
]

CHOREO_DANCER = 'CHOREO_DANCER'
CHOREO_FAN = 'CHOREO_FAN'
CHOREO_APATHY = 'CHOREO_APATHY'

CHOREO_HEADER = header_item("Choreo", "Hiphop choreography, urban dance choreography, jazz-funk, contemporary hiphop, etc.")
CHOREO_LIST = [
    list_item(CHOREO_APATHY, "Choreo Apathy", "You're not a fan of hiphop choreography, it's just not your scene."),
    list_item(CHOREO_FAN, "Choreo Fan", "You love watching hiphop choreography in performances and shows, including hiphop choreography competitions."),
    list_item(CHOREO_DANCER, "Choreo Dancer", "Not just a fan, but you love hiphop workshops, auditions, and everything else in the hiphop choreography scene (also known as urban choreography scene.) This can potentially include jazz funk, hiphop/jazz, and other such blends of styles."),
]

DANCE_CHOREO = 'CHOREO'
DANCE_FREESTYLE = 'FREESTYLE'

DANCES = [DANCE_FREESTYLE, DANCE_CHOREO]
DANCE_HEADERS = {DANCE_FREESTYLE: FREESTYLE_HEADER, DANCE_CHOREO: CHOREO_HEADER}
DANCE_LISTS = {DANCE_FREESTYLE: FREESTYLE_LIST, DANCE_CHOREO: CHOREO_LIST}

class User(db.Model):
    fb_uid = db.IntegerProperty()
    address = db.StringProperty()
    freestyle = db.StringProperty()
    choreo = db.StringProperty()

def get_timezone_for_user(facebook):
    query = 'select timezone from user where uid = %s' % facebook.uid
    results = facebook.fql.query(query)
    return results[0]['timezone']

