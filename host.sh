hub_url=$1
hub_pw=$2
mongo_host=$3

openssl genrsa -out cert.pem 2048
openssl rsa -in cert.pem -pubout -out cert.pub
pubkey = $(cat cert.pub)

# declare mongo host
curl -X POST "$hub_url/post/variable" --data "{admin_password: $hub_pw, variable = $mongo_host}"

# host app
NODE_ID=$(curl -X POST "$hub_url/post/auth" --data "{admin_password: $hub_pw, pubkey = $pubkey}")


nodejs index.js $NODE_ID $hub_pw
