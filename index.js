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

if (process.argv.length < 4) {
    console.log("Usage: " + __filename + " NODE_ID HUB_URL");
    process.exit(-1);
} else {
    var NODE_ID = process.argv[2];
    var HUB_URL = process.argv[3];
}

// get auth db url from hub
var MONGO_URL;
sa.get(HUB_URL + "/get/variables/one/auth_db_url").end(function(sa_err, sa_res) {
    if (sa_err) {
        key_rej();
    }
    var res = JSON.parse(sa_res)
    if (res) {
        MONGO_URL = res;
    } else {
        key_rej();
    }
})

// take in body without sign
function sign_body(body) {
    var sign = crypto.createSign('RSA-SHA256');
    sign.update(JSON.stringify(body));
    return sign.sign(key, 'base64');
}

// this won't live here, but, for symmetry
// take in request, validate body using headers
function validate_origin(req) {
    var node_id = req.header("keyId");
    var node_id = req.header("Signature");
    var ver_promise = new Promise(function(resolve, reject) {
        function val_sign(pub) {
            var ver = crypto.createVerify('RSA-SHA256');
            ver.update(JSON.stringify(req.body))
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
                var res = JSON.parse(sa_res)
                if (res) {
                    key_res(res);
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
            var res = JSON.parse(sa_res)
            if (res.length) {
                // pick and resolve a random element
                resolve(res[Math.floor(Math.random() * (res.length))]);
            } else {
                reject();
            }
        })
    })
}

app.route("/api/:service")
    // see notes below, I has a lot of needless trouble signing get requests
    // NOTE the signature is done through headers, node id in keyId, signature in Signature
    // NOTE that get signs only the user id, which is in the 'userid' header.
    .get(function(req, res) {
        var resolve_get = function(service_path) {
            forward_get = function(user_id) {
                var body = req.body;
                delete body['api_key'];
                sa.get(service_path + "/" + req.originalUrl.splice(3).join("/"))
                    .set({
                        'userid': user_id,
                        'keyId': NODE_ID,
                        'Signature': sign_body(user_id)
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
            validate_user(req.body.api_key).then(forward_get).catch(res.sendStatus(401));
        }
        find_service_host(req.params.service).then(resolve_get).catch(res.sendStatus(401));
    })
    .post(function(req, res) {
        var resolve_post = function(service_path) {
            forward_post = function(user_id) {
                var body = req.body;
                delete body['api_key'];
                body['_user_id'] = user_id;
                sa.post(service_path + "/" + req.originalUrl.splice(33).join("/"))
                    .set({
                        'keyId': NODE_ID,
                        'Signature': sign_body(body)
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
            validate_user(req.body.api_key).then(forward_post).catch(res.sendStatus(401));
        }
        find_service_host(req.params.service).then(resolve_post).catch(res.sendStatus(401));
    })
    .put(function(req, res) {
        var resolve_put = function(service_path) {
            forward_put = function(user_id) {
                var body = req.body;
                delete body['api_key'];
                body['_user_id'] = user_id;
                sa.put(service_path + "/" + req.originalUrl.splice(33).join("/"))
                    .set({
                        'keyId': NODE_ID,
                        'Signature': sign_body(body)
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
            validate_user(req.body.api_key).then(forward_put).catch(res.sendStatus(401));
        }
        find_service_host(req.params.service).then(resolve_put).catch(res.sendStatus(401));
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
                dbo.db("dh_auth");
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
                dbo.db("dh_auth");
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
                dbo.db("dh_auth");
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
