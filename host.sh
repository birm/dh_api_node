hub_url=$1
hub_pw=$2
mongo_host=$3

openssl genrsa -out cert.pem 2048
openssl rsa -in cert.pem -pubout -out cert.pub
pubkey=$(cat cert.pub)

# declare mongo host
curl -X POST "$hub_url/post/variable" --data "{admin_password: $hub_pw, variable = $mongo_host}"

# host app
NODE_ID=$(curl -X POST "$hub_url/post/auth" --data "{admin_password: $hub_pw, pubkey = $pubkey}")

mongo --host $mongo_host dh_auth --eval 'db.createCollection("users")'
mongo --host $mongo_host dh_auth --eval 'db.users.createIndex( { "username": 1 }, { unique: true } )'


nodejs index.js $NODE_ID $hub_url $mongo_host
