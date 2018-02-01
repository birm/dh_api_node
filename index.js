var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const fs = require('fs');
var sa = require('superagent');

const crypto = require('crypto');


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var pri = fs.readFileSync('./cert.pem').toString('base64');;
var pub = fs.readFileSync('./cert.pub').toString('base64');;

// TODO this needs to know how to reach a deployment hub
// TODO it needs to declare its key to the hub, which means it nedds pw
// we need to know out node id, as assigned by central
var NODE_ID;

function validate_user(key){
  var promise = new Promise(function(resolve, reject){
    // TODO actually check for the user
    var user_id = 1;
    if (user_id){
      resolve(user_id);
    } else {
      reject();
    }
  });
  return promise;
}

// take in body without sign
function sign_body(body){
  var sign = crypto.createSign('RSA-SHA256');
  sign.update(JSON.stringify(body));
  return sign.sign(key, 'base64');
}

// this won't live here, but, for symmetry
// take in body without sign
// will need a way to get pub from hub
function validate(pub, node_id, body, signature){
  var promise = new Promise(function (resolve, reject){
    var ver = crypto.createVerify('RSA-SHA256');
    ver.update(JSON.stringify(body))
    if (ver.verify(pub, signature, 'base64')){
      resolve(body)
    } else {
      reject ()
    }
  });
  return promise;
}

function find_service_host(service){
  TODO
}

app.route("/api/:service")
  // see bwlow, I has a lot of needless trouble signing get requests
  // NOTE key verification for get is done with headers
  // keyId contains the node id per the hub
  // signature contains the signature of the url
  // userid contains the verified user id
  // use of these are technically optional, but recommended
  // NOTE that get signatures are of user id ONLY
  // NOTE that this only happens for get, put and post contain it in the body
  .get(function (req, res){
    forward_get = function(user_id){
      var body = req.body;
      delete body['api_key'];
      sa.get(find_service_host(req.params.service) +"/" req.originalUrl.splice(3).join("/"))
        .set({'userid': user_id, 'keyId': NODE_ID ,'Signature': sign_body(user_id);
        .send(body);
        .end(function(sa_err, sa_res){
          if (sa_err){
            res.sendStatus(500);
          } else {
            res.json(sa_res);
          }
        })
    }
    validate_user(req.body.api_key).then(forward_get).catch(res.sendStatus(401));
  })
  .post(function (req, res){
    req.originalUrl
    forward_get = function(user_id){
      var body = req.body;
      delete body['api_key'];
      body['user_id'] = user_id;
      body['node_id'] = NODE_ID;
      body['signature'] = sign_body(body);
      sa.post(find_service_host(req.params.service) +"/" req.originalUrl.splice(33).join("/"))
        .send(body);
        .end(function(sa_err, sa_res){
          if (sa_err){
            res.sendStatus(500)
          } else {
            res.json(sa_res);
          }
        })
    }
    validate_user(req.body.api_key).then(forward_get).catch(res.sendStatus(401));
  })
  .put(function (req, res){
    req.originalUrl
    forward_get = function(user_id){
      var body = req.body;
      delete body['api_key'];
      body['user_id'] = user_id;
      body['node_id'] = NODE_ID;
      body['signature'] = sign_body(body);
      sa.put(find_service_host(req.params.service) +"/" req.originalUrl.splice(3).join("/"))
        .send(body);
        .end(function(sa_err, sa_res){
          if (sa_err){
            res.sendStatus(500)
          } else {
            res.json(sa_res);
          }
        })
    }
    validate_user(req.body.api_key).then(forward_get).catch(res.sendStatus(401));
  })

// add user
