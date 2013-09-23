console.log(process.env.FORECAST_APIKEY);

var googlePlaces = require("google-places-textsearch");
var placesClient = new googlePlaces(process.env.GOOGLE_APIKEY);

var forecast = require("forecast.io");
var forecastOptions = {
  APIKey: process.env.FORECAST_APIKEY
};
var forecastClient = new forecast(forecastOptions);

var twilio = require("twilio");
var twilioClient = new twilio.RestClient(process.env.TWILIO_SID,
                                         process.env.TWILIO_AUTHKEY);

var express = require("express");
var app = express();

var port = process.env.PORT;
var userNumber;

app.all('/', function(request, response) {
    twilioClient.listSms({
        to: '+441572460315'
    }, sendForecastBySms);
    var resp = new twilio.TwimlResponse();
    resp.message("foo");

    response.type('text/xml');
    response.send(resp.toString());
});

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

function getForecastForLocation(error, placesResp) {
    if (!error) {
        var lat = placesResp.results[0].geometry.location.lat.toFixed(4);
        var long = placesResp.results[0].geometry.location.lng.toFixed(4);

        console.log("lat:", lat, ",", "long:", long);

        forecastClient.get(lat, long, sendSms);
    }
    else {
        console.log('Oops! getForecastForLocation threw an error.', error);
    }
}

function sendSms(error, result, forecastResp) {
    if (!error) {
        var forecastMessage = "Next hour: " + forecastResp.minutely.summary + "\n" + "Next 24 hours: " + forecastResp.hourly.summary;

        console.log(forecastMessage, "\n");

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

function handleTwillioResponse(error, message) {
    if (!error) {
        console.log('Successfully replied! The SID for this SMS is:', message.sid);
        console.log('Message sent on:', message.dateCreated);
    }
    else {
        console.log('Oops! handleTwillioResponse threw an error.', error);
    }
}

app.listen(port, function() {
    console.log("Listening on " + port);
});