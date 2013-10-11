/* set up Google Places API stuff */
var googlePlaces = require("google-places-textsearch");
var placesClient = new googlePlaces(process.env.GOOGLE_APIKEY);

/* set up Forecast.io API stuff */
var forecast = require("forecast.io");
var forecastOptions = {
  APIKey: process.env.FORECAST_APIKEY
};
var forecastClient = new forecast(forecastOptions);

/* set up Twilio API stuff */
var twilio = require("twilio");
var twilioClient = new twilio.RestClient(process.env.TWILIO_SID,
                                         process.env.TWILIO_AUTHKEY);

/* set up Express */
var express = require("express");
var app = express();

/* misc variables used later in the code */
var port = process.env.PORT;
var userNumber;

/* Listen on the root directory for requests, and send an empty response back
 * so that Twilio doesn't complain about timeouts or empty replies */
app.all('/', function(request, response) {
    twilioClient.listSms({
        to: '+441572460315'
    }, sendForecastBySms);
    var resp = new twilio.TwimlResponse();

    response.type('text/xml');
    response.send(resp);
});

/* Get the body from the user's SMS and try and find the weather for it,
 * culminating in a SMS reply */
function sendForecastBySms(error, responseData) {
    if (!error) {
        var userMessage = responseData.smsMessages[0].body;
        userNumber = responseData.smsMessages[0].from;

        console.log(userNumber, "requesting weather for", userMessage);

        placesClient.textSearch({
            query: userMessage
        }, getForecastForLocation);
    }
    else {
        console.log('Oops! sendForecastBySms threw an error.', error);
    }
}

/* Look up the longitude and latitude for a location and request the forecast
 * for that lat/long */
function getForecastForLocation(error, placesResp) {
    if (!error) {
        var lat = placesResp.results[0].geometry.location.lat.toFixed(4);
        var long = placesResp.results[0].geometry.location.lng.toFixed(4);

        console.log("lat:", lat, ",", "long:", long);

        var options = {
            units: "uk"
        }
        forecastClient.get(lat, long, options, sendSms);
    }
    else {
        console.log('Oops! getForecastForLocation threw an error.', error);
    }
}

/* Build the forecast message and send it back to the user via Twilio */
function sendSms(error, result, forecastResp) {
    if (!error) {
        var forecastMessage;
        if (typeof forecastResp.minutely !== "undefined") {
             forecastMessage = "Apparent temperature:" + forecastResp.currently.apparentTemperature + "°C\n"
                             + "Currently: " + forecastResp.currently.summary + "\n"
                             + "Next hour: " + forecastResp.minutely.summary + "\n"
                             + "Next 24 hours: " + forecastResp.hourly.summary;
        }
        else if (typeof forecastResp.hourly !== "undefined") {
            forecastMessage = "Apparent temperature:" + forecastResp.currently.apparentTemperature + "°C\n"
                            + "Currently: " + forecastResp.currently.summary + "\n"
                            + "Next 24 hours: " + forecastResp.hourly.summary;
        }
        else {
            forecastMessage = "We've had issues getting forecast data for your search, sorry! :-(";
        }

        console.log(forecastMessage);

        twilioClient.sms.messages.create({
            to: userNumber,
            from: '+441572460315',
            body: forecastMessage
        }, handleTwillioResponse);
    }
    else {
        console.log('Oops! sendSms threw an error.', error);
    }
}

/* Handle errors/log success from Twilio after the reply is sent */
function handleTwillioResponse(error, message) {
    if (!error) {
        console.log('Successfully replied! The SID for this SMS is:', message.sid);
        console.log('Message sent on:', message.dateCreated);
    }
    else {
        console.log('Oops! handleTwillioResponse threw an error.', error);
    }
}

/* Start listening for requests! */
app.listen(port, function() {
    console.log("Listening on " + port);
});