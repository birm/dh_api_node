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

var pri = fs.readFileSync('./cert.pem', 'utf8');
var pub = fs.readFileSync('./cert.pub', 'utf8');


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
    return sign.sign(pri, 'base64');
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
                    key_rej(sa_err);
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
                reject({PLACE:1, err: sa_err});
            }
            var host_list = sa_res.body;
            if (host_list.length) {
                // pick and resolve a random element
                resolve(host_list[Math.floor(Math.random() * (host_list.length))]);
            } else {
                reject({PLACE:2, service: service});
            }
        })
    })
}

function validate_user(key) {
  return new Promise(function (resolve, reject){
    run_mongo("findOne",  {api_key:key}, [], "users", function(user){
      if (user && user.api_key && user.expires > Date.now()) {
        resolve(user.username);
      } else {
        reject({PLACE:3, user:user, key:key});
      }
    });
  })
}

app.use("/api", function(req,res){
  // NOTE the signature is done through headers, node id in keyId, signature in Signature
  // API key expected in api_key header in
  var resolve_get = function(service_path) {
      forward_get = function(user_id) {
          sa.get(service_path + "/" + req.originalUrl.split("/").splice(3).join("/"))
              .set({
                  'userid': user_id,
                  'keyId': NODE_ID,
                  'Signature': sign_req(user_id, req.originalUrl)
              })
              .then((d) => (res.send(d.text)))
              .catch((e) => (res.send(e)))
      }
      validate_user(req.header('api_key')).then(forward_get).catch((e)=>(res.send(e)));
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
              .then((d) => (res.send(d.text)))
              .catch((e) => (res.send(e)))
      }
      validate_user(req.header('api_key')).then(forward_post).catch((e)=>(res.send(e)));
  }
  var resolve_put = function(service_path) {
      forward_put = function(user_id) {
          var body = req.body;
          sa.put(service_path + "/" + req.originalUrl.split("/").splice(3).join("/"))
              .set({
                  'userid': user_id,
                  'keyId': NODE_ID,
                  'Signature': sign_req(req.body, req.originalUrl)
              })
              .send(body)
              .then((d) => (res.send(d.text)))
              .catch((e) => (res.send(e)))
      }
      validate_user(req.header('api_key')).then(forward_put).catch(function(e){
        res.send(e)
      });
  }
  if (req.method === "GET"){
    find_service_host(req.originalUrl.split("/")[2]).then(resolve_get).catch(function(e){
      res.send(e)
    });
  }
  else if (req.method === "POST"){
    find_service_host(req.originalUrl.split("/")[2]).then(resolve_post).catch(function(e){
      res.send(e)
    });
  }
  else if (req.method === "PUT"){
    find_service_host(req.originalUrl.split("/")[2]).then(resolve_put).catch(function(e){
      res.send(e)
    });
  }
})

function run_mongo(operation, query, data, collection, callback){
  MongoClient.connect(MONGO_URL, function(err, db) {
      if (err) {
          throw err
      }
      var dbo = db.db("dh_auth");
      function handle_result(err, result){
        if (err){
          callback(err);
        } else {
          callback(result);
        }
      }
      if (operation === "insertOne"){
        dbo.collection(collection).insertOne(data, handle_result);
      } else if (operation === "findOne"){
        dbo.collection(collection).findOne(query, handle_result);
      } else if (operation === "updateOne"){
        dbo.collection(collection).updateOne(query, { $set: data }, handle_result);
      }
      db.close();

  });
}

function login_user(name, auth, res) {
  run_mongo("findOne",  {username:name}, [], "users", function(user){
    if (user.auth === auth){
      if (user.api_key && user.expires > Date.now()) {
        res.send(user.api_key);
      } else {
        var api_key = crypto.randomBytes(20).toString('hex');
        run_mongo("updateOne",  {username:name, auth: auth}, {
            api_key: api_key,
            expires: Date.now() + 3600000
        },  "users", function(e){
          if(e.name === "MongoError"){
          res.sendStatus(500)
        } else {
          res.send(api_key)
        }})
      }
    } else {
      res.sendStatus(401);
    }
  });
}


// user endpoints
app.post("/user/new", function(req,res){
    run_mongo("insertOne", [], {username: req.body.name, auth: req.body.auth}, "users", (x) => res.send(x));
})
app.post("/user/login", function(req,res){
    login_user(req.body.name, req.body.auth, res);
})


app.listen(8081, () => console.log('Listening'));
