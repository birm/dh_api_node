var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const fs = require('fs');
var sa = require('superagent');

const crypto = require('crypto');

var MongoClient = require('mongodb').MongoClient;

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

var pri = fs.readFileSync('./cert.pem').toString('base64');;
var pub = fs.readFileSync('./cert.pub').toString('base64');;


if (process.argv.length < 5) {
    console.log("Usage: " + __filename + " NODE_ID HUB_URL MONGO_URL");
    process.exit(-1);
} else {
    var NODE_ID = process.argv[2];
    var HUB_URL = process.argv[3];
    var MONGO_URL = "mongodb://" + process.argv[4];
}

// take in body without sign
function sign_req(body, url) {
    var sign = crypto.createSign('RSA-SHA256');
    var test_body = {body: body, path: url}
    sign.update(JSON.stringify(test_body));
    return sign.sign(key, 'base64');
}

// this won't live here, but, for symmetry
// take in request, validate body using headers
function validate_origin(req, service) {
    var node_id = req.header("keyId");
    var signature = req.header("Signature");
    // if we're signing user_id (get)
    if (req.header("userid")){
      body = req.header("userid")
    } else {
      body = req.body
    }
    test_body = {body: body, path: "/api/" + service + req.originalUrl}
    body.url = req.originalUrl.splice(3).split("/").join("/")
    var ver_promise = new Promise(function(resolve, reject) {
        function val_sign(pub) {
            var ver = crypto.createVerify('RSA-SHA256');
            ver.update(JSON.stringify(test_body))
            if (ver.verify(pub, signature, 'base64')) {
                resolve(body)
            } else {
                reject()
            }
        }
        var key_promise = new Promise(function(key_res, key_rej) {
            sa.get(HUB_URL + "/get/key/" + node_id).end(function(sa_err, sa_res) {
                if (sa_err) {
                    key_rej();
                }
                var res_key = JSON.parse(sa_res || "[]").key;
                if (res_key) {
                    key_res(res_key);
                } else {
                    key_rej();
                }
            })
        });
        key_promise.then(val_sign).catch(reject);
    });

    return ver_promise;
}

function find_service_host(service) {
    return new Promise(function(resolve, reject) {
        sa.get(HUB_URL + "/get/services/one/" + service).end(function(sa_err, sa_res) {
            if (sa_err) {
                reject();
            }
            var res = JSON.parse(sa_res  || "[]")
            if (res.length) {
                // pick and resolve a random element
                resolve(res[Math.floor(Math.random() * (res.length))]);
            } else {
                reject();
            }
        })
    })
}

app.use("/api/:service", function(req,res){
  // NOTE the signature is done through headers, node id in keyId, signature in Signature
  // API key expected in api_key header in
  var resolve_get = function(service_path) {
      forward_get = function(user_id) {
          var body = req.body;
          delete body['api_key'];
          sa.get(service_path + "/" + req.originalUrl.split("/").splice(3).join("/"))
              .set({
                  'userid': user_id,
                  'keyId': NODE_ID,
                  'Signature': sign_req(user_id, req.originalUrl)
              })
              .send(body)
              .end(function(sa_err, sa_res) {
                  if (sa_err) {
                      res.sendStatus(500);
                  } else {
                      res.json(sa_res);
                  }
              })
      }
      validate_user(req.header.api_key).then(forward_get).catch(res.sendStatus(401));
  }
  var resolve_post = function(service_path) {
      forward_post = function(user_id) {
          var body = req.body;
          sa.post(service_path + "/" + req.originalUrl.split("/").splice(3).join("/"))
              .set({
                  'userid': user_id,
                  'keyId': NODE_ID,
                  'Signature': sign_req(req.body, req.originalUrl)
              })
              .send(body)
              .end(function(sa_err, sa_res) {
                  if (sa_err) {
                      res.sendStatus(500)
                  } else {
                      res.json(sa_res);
                  }
              })
      }
      validate_user(req.header.api_key).then(forward_post).catch(res.sendStatus(401));
  }
  var resolve_put = function(service_path) {
      forward_put = function(user_id) {
          var body = req.body;
          delete body['api_key'];
          sa.put(service_path + "/" + req.originalUrl.split("/").splice(3).join("/"))
              .set({
                  'userid': user_id,
                  'keyId': NODE_ID,
                  'Signature': sign_req(req.body, req.originalUrl)
              })
              .send(body)
              .end(function(sa_err, sa_res) {
                  if (sa_err) {
                      res.sendStatus(500)
                  } else {
                      res.json(sa_res);
                  }
              })
      }
      validate_user(req.header.api_key).then(forward_put).catch(res.sendStatus(401));
  }
  if (req.method === "GET"){
    find_service_host(req.params.service).then(resolve_get).catch(res.sendStatus(401));
  }
  else if (req.method === "POST"){
    find_service_host(req.params.service).then(resolve_post).catch(res.sendStatus(401));
  }
  else if (req.method === "PUT"){
    find_service_host(req.params.service).then(resolve_put).catch(res.sendStatus(401));
  }
})

// users
function new_user(name, auth) {
    return new Promise(function(reject, resolve) {
        // add to database
        if (!MONGO_URL) {
            reject();
        } else {
            MongoClient.connect(MONGO_URL, function(err, db) {
                if (err) {
                    reject();
                }
                dbo = db.db("dh_auth");
                dbo.collection("users").insertOne({
                    username: name,
                    auth: auth
                }, function(err, result) {
                    if (err) {
                        reject();
                    }
                    if (result.expires > Date.now()) {
                        resolve();
                    } else {
                        reject();
                    }

                    db.close();
                });
            });
        }
    });
}

function login_user(name, auth) {
    return new Promise(function(reject, resolve) {
        // add to database
        if (!MONGO_URL) {
            reject();
        } else {
            MongoClient.connect(MONGO_URL, function(err, db) {
                if (err) {
                    reject();
                }
                dbo = db.db("dh_auth");
                dbo.collection("users").findOne({
                    username: name
                }, function(err, result) {
                    if (err) {
                        reject();
                    }
                    if (result.auth === auth) {
                        // if the key is valid, give the key
                        if (!result.api_key || result.expires > Date.now()) {
                            resolve(result.api_key);
                        } else {
                            // if not, give a new key
                            let api_key = crypto.randomBytes(20).toString('hex');
                            dbo.collection("users").updateOne({
                                username: name
                            }, {
                                api_key: api_key,
                                expires: Date.now() + 3600000
                            }, function(err_new, res_new) {
                                if (err) {
                                    reject();
                                }
                                resolve(api_key)
                            });
                        }
                    } else {
                        reject();
                    }
                    db.close();
                });
            });
        }
    });
}


function validate_user(key) {
    return new Promise(function(resolve, reject) {
        if (!MONGO_URL) {
            reject();
        } else {
            MongoClient.connect(MONGO_URL, function(err, db) {
                if (err) {
                    reject();
                }
                dbo = db.db("dh_auth");
                dbo.collection("users").findOne({
                    api_key: key
                }, function(err, result) {
                    if (err) {
                        reject();
                    }
                    if (result.expires > Date.now()) {
                        resolve(result.username);
                    } else {
                        reject();
                    }

                    db.close();
                });
            });
        }
    });
}

// user endpoints
app.post("/user/new", function(req,res){
    new_user(req.body.name, req.body.auth).then(res.send).catch(()=>(res.sendStatus(500)));
})
app.post("/user/login", function(req,res){
    login_user(req.body.name, req.body.auth).then(res.send).catch(()=>(res.sendStatus(401)));
})

app.listen(8081, () => console.log('Listening'));
