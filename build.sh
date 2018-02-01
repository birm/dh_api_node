# Should be run as  sudo bash run.sh <hub url> <admin pw>
HUB_URL = $2
ADMIN_PW = $3

# install dependencies
apt-get --yes --force-yes install npm
apt-get --yes --force-yes install openssl
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
apt-get install -y nodejs
npm install
# we need a private key
openssl genrsa -out cert.pem 2048
openssl rsa -in cert.pem -pubout -out cert.pub
# host app
curl -X POST $HUB_URL --data "{admin_password: $ADMIN_PW, pubkey = $PUBKEY}"
NODE_ID
nodejs index.js $NODE_ID $HUB_URL &&
