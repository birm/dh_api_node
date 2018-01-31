var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const fs = require('fs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// TODO request to forward
// get user id from api key, check valid
// repackage request if valid
// get a node which offers this service
// send the request to this node
// redirect the result back to requester

// add user

// I'm thinking permissions should be a service, so each deployment can handle as needed
