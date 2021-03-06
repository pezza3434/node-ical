var ical = require('./ical')
  , request = require('request')
  , fs = require('fs')

var moment = require('moment-timezone');  

exports.fromURL = function(url, opts, defaultTimezone, cb){
  if (!cb)
    return;
  request(url, opts, function(err, r, data){
    if (err)
      return cb(err, null);
    cb(undefined, ical.parseICS(data, defaultTimezone));
  })
}

exports.parseFile = function(filename){
  return ical.parseICS(fs.readFileSync(filename, 'utf8'))
}


var rrule = require('rrule').RRule

ical.objectHandlers['RRULE'] = function(val, params, curr, stack, line){
  curr.rrule = line;
  return curr
}
var originalEnd = ical.objectHandlers['END'];
ical.objectHandlers['END'] = function (val, params, curr, stack, dontcare, timezone) {
	// Recurrence rules are only valid for VEVENT, VTODO, and VJOURNAL.
	// More specifically, we need to filter the VCALENDAR type because we might end up with a defined rrule
	// due to the subtypes.
	if ((val === "VEVENT") || (val === "VTODO") || (val === "VJOURNAL")) {
		if (curr.rrule) {
			var rule = curr.rrule.replace('RRULE:', '');
			if (rule.indexOf('DTSTART') === -1) {

                // Dont believe this is needed anymore
				// if (curr.start.length === 8) {
				// 	var comps = /^(\d{4})(\d{2})(\d{2})$/.exec(curr.start);
				// 	if (comps) {
				// 		curr.start = new Date(comps[1], comps[2] - 1, comps[3]);
				// 	}
				// }

                // Passing the tzid to RRULE means it handles DST for us. For some reason I don't understand we have to pass the current momentTZ time as a UTC isostring
				rule += ';DTSTART;TZID=' + curr.start.timezone + ':' + curr.start.momentTZ.format('YYYY-MM-DD[T]HHmmss[Z]').replace(/[-:]/g, '');
				rule = rule.replace(/\.[0-9]{3}/, '');
			}

            // Change the until timezone for rrule. https://github.com/jakubroztocil/rrule/issues/331
            const regexForUTCUNTILTimeWeExpect = /UNTIL=\d{8}T\d{6}Z/;
            if (curr.start.timezone && regexForUTCUNTILTimeWeExpect.test(rule)) {
                const match = rule.match(/UNTIL=(.+?)(?=Z)/);
                const newUNTILTime = moment.tz(match[1], 'utc').tz(curr.start.timezone).format('YYYYMMDD[T]HHmmss');
                rule = rule.replace(/(.*)(UNTIL=)(.+?(?=Z))(.*)/, "$1$2" + newUNTILTime + "$4");
            }
			curr.rrule = rrule.fromString(rule);
		}
	}
  return originalEnd.call(this, val, params, curr, stack);
}
